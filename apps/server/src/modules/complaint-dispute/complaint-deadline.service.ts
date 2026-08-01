import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { COMPLAINT_EVENT_ACTION, COMPLAINT_STATUS, DECISION_LEVEL } from "@petcare/shared-types";
import type { Prisma } from "../../generated/prisma/client";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { DisputeExecutionService } from "./dispute-execution.service";

type ExpiredComplaintRecord = {
  id: string;
  complainantId: string;
  respondentId: string;
  status: string;
  version: number;
  appealDeadlineAt: Date | null;
  order: { providerId: string | null };
  decisions: Array<{
    id: string;
    decisionAdminId: string;
    level: string;
    liability: string;
    reason: string;
    refundAmount: number;
    settlementAmount: number;
    complainantCreditDelta: number;
    respondentCreditDelta: number;
  }>;
};

type FinalTask = {
  taskType: "refund" | "settlement" | "complainant_credit" | "respondent_credit";
  payload: string;
};

const MAX_EXPIRED_BATCH_SIZE = 100;

@Injectable()
export class ComplaintDeadlineService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private maintenanceRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly executionService: DisputeExecutionService,
    private readonly logger: AppLogger,
  ) {}

  /** 启动每分钟一次且不阻止进程退出的有界维护任务。 */
  onModuleInit(): void {
    this.timer = setInterval(() => void this.runMaintenanceTick(), 60_000);
    this.timer.unref();
  }

  /** 关闭最多一百条已超过申诉期的案件，并将初裁提升为最终执行依据。 */
  async closeExpiredAppealWindows(now: Date): Promise<number> {
    const candidates = await this.prisma.complaint.findMany({
      where: {
        status: COMPLAINT_STATUS.INITIAL_DECIDED,
        appealDeadlineAt: { lte: now },
      },
      orderBy: { appealDeadlineAt: "asc" },
      take: MAX_EXPIRED_BATCH_SIZE,
      select: { id: true, version: true },
    });
    const results = await Promise.all(
      candidates.map((candidate) =>
        this.prisma.$transaction(async (transaction) =>
          this.closeCandidate(transaction, candidate, now),
        ),
      ),
    );

    return results.filter(Boolean).length;
  }

  /** 清理模块生命周期创建的维护定时器。 */
  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** 串行执行到期结案与任务消费，并避免维护 tick 重叠。 */
  private async runMaintenanceTick(): Promise<void> {
    if (this.maintenanceRunning) {
      return;
    }

    this.maintenanceRunning = true;

    try {
      await this.closeExpiredAppealWindows(new Date());
    } catch (error) {
      this.logger.write("error", "complaint.deadline_maintenance_failed", {
        error: this.errorMessage(error),
      });
    }

    try {
      await this.executionService.processDueTasks(MAX_EXPIRED_BATCH_SIZE);
    } catch (error) {
      this.logger.write("error", "complaint.execution_maintenance_failed", {
        error: this.errorMessage(error),
      });
    } finally {
      this.maintenanceRunning = false;
    }
  }

  /** 以状态和版本条件抢占单条到期案件并完成所有结案写入。 */
  private async closeCandidate(
    transaction: Prisma.TransactionClient,
    candidate: { id: string; version: number },
    now: Date,
  ): Promise<boolean> {
    const complaint = await transaction.complaint.findUnique({
      where: { id: candidate.id },
      select: {
        id: true,
        complainantId: true,
        respondentId: true,
        status: true,
        version: true,
        appealDeadlineAt: true,
        order: { select: { providerId: true } },
        decisions: {
          where: { level: DECISION_LEVEL.INITIAL },
          take: 1,
          select: {
            id: true,
            decisionAdminId: true,
            level: true,
            liability: true,
            reason: true,
            refundAmount: true,
            settlementAmount: true,
            complainantCreditDelta: true,
            respondentCreditDelta: true,
          },
        },
      },
    });
    const initialDecision = complaint?.decisions[0];

    if (!complaint || !initialDecision) {
      return false;
    }

    const updated = await transaction.complaint.updateMany({
      where: {
        id: candidate.id,
        status: COMPLAINT_STATUS.INITIAL_DECIDED,
        version: candidate.version,
        appealDeadlineAt: { lte: now },
      },
      data: {
        status: COMPLAINT_STATUS.CLOSED,
        appealDeadlineAt: null,
        closedAt: now,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return false;
    }

    const tasks = this.finalTasks(complaint, initialDecision);

    if (tasks.length > 0) {
      await transaction.disputeExecutionTask.createMany({
        data: tasks.map((task) => ({
          complaintId: complaint.id,
          decisionId: initialDecision.id,
          decisionLevel: DECISION_LEVEL.INITIAL,
          taskType: task.taskType,
          payload: task.payload,
          idempotencyKey: `${complaint.id}:${DECISION_LEVEL.INITIAL}:${task.taskType}`,
        })),
        skipDuplicates: true,
      });
    }

    await transaction.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: null,
        action: COMPLAINT_EVENT_ACTION.APPEAL_TIMEOUT_CLOSE,
        fromStatus: COMPLAINT_STATUS.INITIAL_DECIDED,
        toStatus: COMPLAINT_STATUS.CLOSED,
        payload: JSON.stringify({
          initialDecisionId: initialDecision.id,
        }),
        createdAt: now,
      },
    });

    return true;
  }

  /** 从初裁非零影响生成最终层级幂等任务。 */
  private finalTasks(
    complaint: ExpiredComplaintRecord,
    decision: ExpiredComplaintRecord["decisions"][number],
  ): FinalTask[] {
    const tasks: Array<FinalTask & { value: number }> = [
      {
        taskType: "refund",
        value: decision.refundAmount,
        payload: JSON.stringify({
          userId: complaint.complainantId,
          amount: decision.refundAmount,
        }),
      },
      {
        taskType: "settlement",
        value: decision.settlementAmount,
        payload: JSON.stringify({
          userId: complaint.order.providerId,
          amount: decision.settlementAmount,
        }),
      },
      {
        taskType: "complainant_credit",
        value: decision.complainantCreditDelta,
        payload: JSON.stringify({
          userId: complaint.complainantId,
          delta: decision.complainantCreditDelta,
        }),
      },
      {
        taskType: "respondent_credit",
        value: decision.respondentCreditDelta,
        payload: JSON.stringify({
          userId: complaint.respondentId,
          delta: decision.respondentCreditDelta,
        }),
      },
    ];

    return tasks
      .filter((task) => task.value !== 0)
      .map(({ taskType, payload }) => ({ taskType, payload }));
  }

  /** 将未知维护异常压缩为可安全记录的结构化字段。 */
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown maintenance error";
  }
}
