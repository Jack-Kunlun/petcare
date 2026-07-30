import { HttpStatus, Injectable } from "@nestjs/common";
import {
  COMPLAINT_STATUS,
  DECISION_LEVEL,
  type ComplaintStatus,
  type DecisionLevel,
  type SubmitDisputeDecisionRequest,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AdminActor } from "./complaint-command.service";
import { assertComplaintAction, type ComplaintActionContext } from "./complaint-state-machine";

type DecisionComplaintRecord = {
  id: string;
  complainantId: string;
  respondentId: string;
  assignedAdminId: string | null;
  status: string;
  appealDeadlineAt: Date | null;
  version: number;
  order: { amount: number; providerId: string | null };
};

type ExecutionTask = {
  taskType: "refund" | "settlement" | "complainant_credit" | "respondent_credit";
  payload: string;
};

const APPEAL_WINDOW_MILLISECONDS = 72 * 60 * 60 * 1000;

@Injectable()
export class DisputeDecisionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 提交初裁并开启固定 72 小时二次申诉窗口。 */
  decideInitial(
    id: string,
    admin: AdminActor,
    request: SubmitDisputeDecisionRequest,
  ): Promise<string> {
    return this.decide(id, admin, DECISION_LEVEL.INITIAL, request, new Date());
  }

  /** 提交不可再次申诉的终裁并关闭案件。 */
  decideFinal(
    id: string,
    admin: AdminActor,
    request: SubmitDisputeDecisionRequest,
  ): Promise<string> {
    return this.decide(id, admin, DECISION_LEVEL.FINAL, request, new Date());
  }

  /** 在单一事务内写入裁决、状态、事件与非零执行任务。 */
  private decide(
    id: string,
    admin: AdminActor,
    level: DecisionLevel,
    request: SubmitDisputeDecisionRequest,
    now: Date,
  ): Promise<string> {
    return this.prisma.$transaction(async (transaction) => {
      const complaint = await this.findComplaint(transaction, id);
      const isInitial = level === DECISION_LEVEL.INITIAL;
      const nextStatus = isInitial ? COMPLAINT_STATUS.INITIAL_DECIDED : COMPLAINT_STATUS.CLOSED;
      const action = isInitial ? "initial_decide" : "final_decide";

      assertComplaintAction(this.toActionContext(complaint, admin), action);
      this.assertDecisionValues(complaint.order.amount, request);

      const existingDecision = await transaction.disputeDecision.findUnique({
        where: {
          complaintId_level: {
            complaintId: id,
            level,
          },
        },
        select: { id: true },
      });

      if (existingDecision) {
        throw new ApiException(
          "DUPLICATE_DISPUTE_DECISION",
          "该层级裁决已经存在",
          HttpStatus.CONFLICT,
        );
      }

      const decision = await transaction.disputeDecision.create({
        data: {
          complaintId: id,
          decisionAdminId: admin.id,
          level,
          liability: request.liability,
          reason: request.reason.trim(),
          refundAmount: request.refundAmount,
          settlementAmount: request.settlementAmount,
          complainantCreditDelta: request.complainantCreditDelta,
          respondentCreditDelta: request.respondentCreditDelta,
          createdAt: now,
        },
        select: { id: true },
      });
      const updated = await transaction.complaint.updateMany({
        where: {
          id,
          status: complaint.status,
          version: request.version,
        },
        data: isInitial
          ? {
              status: nextStatus,
              appealDeadlineAt: new Date(now.getTime() + APPEAL_WINDOW_MILLISECONDS),
              version: { increment: 1 },
            }
          : {
              status: nextStatus,
              appealDeadlineAt: null,
              closedAt: now,
              version: { increment: 1 },
            },
      });

      if (updated.count === 0) {
        throw new ApiException(
          "COMPLAINT_STATE_CONFLICT",
          "投诉状态已变化，请刷新后重试",
          HttpStatus.CONFLICT,
        );
      }

      await transaction.complaintEvent.create({
        data: {
          complaintId: id,
          actorId: admin.id,
          action,
          fromStatus: complaint.status,
          toStatus: nextStatus,
        },
      });

      await Promise.all(
        this.executionTasks(complaint, request).map((task) =>
          transaction.disputeExecutionTask.create({
            data: {
              complaintId: id,
              decisionId: decision.id,
              decisionLevel: level,
              taskType: task.taskType,
              payload: task.payload,
              idempotencyKey: `${id}:${level}:${task.taskType}`,
            },
          }),
        ),
      );

      return id;
    });
  }

  /** 查询裁决命令所需的投诉与订单金额。 */
  private async findComplaint(
    transaction: Prisma.TransactionClient,
    id: string,
  ): Promise<DecisionComplaintRecord> {
    const complaint = await transaction.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        complainantId: true,
        respondentId: true,
        assignedAdminId: true,
        status: true,
        appealDeadlineAt: true,
        version: true,
        order: { select: { amount: true, providerId: true } },
      },
    });

    if (!complaint) {
      throw new ApiException("RESOURCE_NOT_FOUND", "投诉不存在", HttpStatus.NOT_FOUND);
    }

    return complaint;
  }

  /** 构建管理员裁决的状态机上下文。 */
  private toActionContext(
    complaint: DecisionComplaintRecord,
    admin: AdminActor,
  ): ComplaintActionContext {
    return {
      status: complaint.status as ComplaintStatus,
      viewerId: admin.id,
      viewerRole: "admin",
      assignedAdminId: complaint.assignedAdminId,
      isSuperAdmin: admin.roles.includes("super_admin"),
      isOrderParty: admin.id === complaint.complainantId || admin.id === complaint.respondentId,
      appealDeadlineAt: complaint.appealDeadlineAt,
      hasSecondAppealed: false,
      hasFailedExecution: false,
      now: new Date(),
    };
  }

  /** 校验金额守恒、整数分与信用变化范围。 */
  private assertDecisionValues(orderAmount: number, request: SubmitDisputeDecisionRequest): void {
    const amounts = [request.refundAmount, request.settlementAmount];
    const creditDeltas = [request.complainantCreditDelta, request.respondentCreditDelta];
    const invalidAmount =
      amounts.some((amount) => !Number.isInteger(amount) || amount < 0 || amount > orderAmount) ||
      request.refundAmount + request.settlementAmount > orderAmount;
    const invalidCreditDelta = creditDeltas.some(
      (delta) => !Number.isInteger(delta) || delta < -100 || delta > 100,
    );

    if (invalidAmount || invalidCreditDelta) {
      throw new ApiException(
        "INVALID_DISPUTE_DECISION",
        "裁决金额或信用分调整不合法",
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** 将非零金额和信用变化转换为幂等内部任务。 */
  private executionTasks(
    complaint: DecisionComplaintRecord,
    request: SubmitDisputeDecisionRequest,
  ): ExecutionTask[] {
    const tasks: Array<ExecutionTask & { value: number }> = [
      {
        taskType: "refund",
        value: request.refundAmount,
        payload: JSON.stringify({
          userId: complaint.complainantId,
          amount: request.refundAmount,
        }),
      },
      {
        taskType: "settlement",
        value: request.settlementAmount,
        payload: JSON.stringify({
          userId: complaint.order.providerId ?? complaint.respondentId,
          amount: request.settlementAmount,
        }),
      },
      {
        taskType: "complainant_credit",
        value: request.complainantCreditDelta,
        payload: JSON.stringify({
          userId: complaint.complainantId,
          delta: request.complainantCreditDelta,
        }),
      },
      {
        taskType: "respondent_credit",
        value: request.respondentCreditDelta,
        payload: JSON.stringify({
          userId: complaint.respondentId,
          delta: request.respondentCreditDelta,
        }),
      },
    ];

    return tasks
      .filter((task) => task.value !== 0)
      .map(({ taskType, payload }) => ({ taskType, payload }));
  }
}
