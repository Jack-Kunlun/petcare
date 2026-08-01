import { HttpStatus, Injectable } from "@nestjs/common";
import {
  COMPLAINT_STATUS,
  DISPUTE_EXECUTION_TASK_STATUS,
  type DecisionLevel,
  type DisputeExecutionTaskListResponse,
  type DisputeExecutionTaskStatus,
  type DisputeExecutionTaskType,
  type DisputeExecutionTaskView,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type ExecutionTaskRecord = {
  id: string;
  complaintId: string;
  decisionId: string;
  decisionLevel: string;
  taskType: string;
  payload: string | null;
  status: string;
  failureReason: string | null;
  retryCount: number;
  idempotencyKey: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  complaint: { orderId: string };
};

const RETRY_DELAY_MILLISECONDS = 60_000;
const PROCESSING_TIMEOUT_MILLISECONDS = 5 * 60_000;
const MAX_BATCH_SIZE = 100;

@Injectable()
export class DisputeExecutionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 原子领取并执行一项裁决内部副作用，成功任务不会重复消费。 */
  async executeTask(
    taskId: string,
    actorId: string | null = null,
  ): Promise<DisputeExecutionTaskView> {
    const task = await this.findTask(taskId);

    if (
      task.status === DISPUTE_EXECUTION_TASK_STATUS.SUCCEEDED ||
      task.status === DISPUTE_EXECUTION_TASK_STATUS.SUPERSEDED
    ) {
      return this.toView(task);
    }

    const now = new Date();
    const processingTask: ExecutionTaskRecord = {
      ...task,
      status: DISPUTE_EXECUTION_TASK_STATUS.PROCESSING,
      failureReason: null,
      retryCount: task.retryCount + 1,
      completedAt: null,
      updatedAt: now,
    };

    try {
      const outcome = await this.prisma.$transaction(async (transaction) => {
        const complaint = await transaction.complaint.findUnique({
          where: { id: task.complaintId },
          select: {
            status: true,
            decisions: {
              orderBy: { createdAt: "desc" },
              select: { id: true, level: true },
            },
          },
        });

        if (!complaint || complaint.status !== "closed") {
          return "not_ready" as const;
        }

        const finalDecision = complaint.decisions.find((decision) => decision.level === "final");
        const effectiveDecision =
          finalDecision ?? complaint.decisions.find((decision) => decision.level === "initial");

        if (!effectiveDecision || effectiveDecision.id !== task.decisionId) {
          const superseded = await transaction.disputeExecutionTask.updateMany({
            where: {
              id: taskId,
              status: {
                in: [DISPUTE_EXECUTION_TASK_STATUS.PENDING, DISPUTE_EXECUTION_TASK_STATUS.FAILED],
              },
            },
            data: {
              status: DISPUTE_EXECUTION_TASK_STATUS.SUPERSEDED,
              failureReason: null,
              completedAt: now,
              updatedAt: now,
            },
          });

          return superseded.count > 0 ? ("superseded" as const) : ("claim_lost" as const);
        }

        const claimed = await transaction.disputeExecutionTask.updateMany({
          where: {
            id: taskId,
            status: {
              in: [DISPUTE_EXECUTION_TASK_STATUS.PENDING, DISPUTE_EXECUTION_TASK_STATUS.FAILED],
            },
          },
          data: {
            status: DISPUTE_EXECUTION_TASK_STATUS.PROCESSING,
            retryCount: { increment: 1 },
            failureReason: null,
            completedAt: null,
            updatedAt: now,
          },
        });

        if (claimed.count === 0) {
          return "claim_lost" as const;
        }

        await this.applyEffect(transaction, processingTask, now);
        const completed = await transaction.disputeExecutionTask.updateMany({
          where: {
            id: taskId,
            status: DISPUTE_EXECUTION_TASK_STATUS.PROCESSING,
          },
          data: {
            status: DISPUTE_EXECUTION_TASK_STATUS.SUCCEEDED,
            failureReason: null,
            completedAt: now,
            updatedAt: now,
          },
        });

        if (completed.count === 0) {
          throw new Error("Execution task claim was lost");
        }

        await transaction.complaintEvent.create({
          data: {
            complaintId: task.complaintId,
            actorId,
            action: "execution_succeeded",
            payload: JSON.stringify({ taskId: task.id, taskType: task.taskType }),
          },
        });

        return "succeeded" as const;
      });

      if (outcome === "not_ready" || outcome === "claim_lost") {
        return this.toView(await this.findTask(taskId));
      }

      if (outcome === "superseded") {
        return this.toView({
          ...task,
          status: DISPUTE_EXECUTION_TASK_STATUS.SUPERSEDED,
          failureReason: null,
          completedAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      const failureReason = this.failureReason(error);
      const recorded = await this.prisma.$transaction(async (transaction) => {
        const failed = await transaction.disputeExecutionTask.updateMany({
          where: {
            id: taskId,
            status: {
              in: [DISPUTE_EXECUTION_TASK_STATUS.PENDING, DISPUTE_EXECUTION_TASK_STATUS.FAILED],
            },
          },
          data: {
            status: DISPUTE_EXECUTION_TASK_STATUS.FAILED,
            retryCount: { increment: 1 },
            failureReason,
            updatedAt: now,
          },
        });

        if (failed.count > 0) {
          await transaction.complaintEvent.create({
            data: {
              complaintId: task.complaintId,
              actorId,
              action: "execution_failed",
              payload: JSON.stringify({ taskId: task.id, taskType: task.taskType, failureReason }),
            },
          });
        }

        return failed.count;
      });

      if (recorded === 0) {
        return this.toView(await this.findTask(taskId));
      }

      return this.toView({
        ...processingTask,
        status: DISPUTE_EXECUTION_TASK_STATUS.FAILED,
        failureReason,
        updatedAt: now,
      });
    }

    return this.toView({
      ...processingTask,
      status: DISPUTE_EXECUTION_TASK_STATUS.SUCCEEDED,
      completedAt: now,
      updatedAt: now,
    });
  }

  /** 仅重试指定投诉下仍处于失败状态的任务。 */
  async retryTask(
    taskId: string,
    adminId: string,
    complaintId?: string,
  ): Promise<DisputeExecutionTaskView> {
    const failedTask = await this.prisma.disputeExecutionTask.findFirst({
      where: {
        id: taskId,
        ...(complaintId ? { complaintId } : {}),
        status: DISPUTE_EXECUTION_TASK_STATUS.FAILED,
      },
      select: { id: true },
    });

    if (!failedTask) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        "当前投诉下不存在可重试的失败任务",
        HttpStatus.NOT_FOUND,
      );
    }

    return this.executeTask(taskId, adminId);
  }

  /** 恢复超时领取并执行指定上限内已到期的等待或失败任务。 */
  async processDueTasks(limit: number): Promise<DisputeExecutionTaskView[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
      throw new ApiException(
        "INVALID_EXECUTION_BATCH_LIMIT",
        "执行任务批次必须为 1 至 100 的整数",
        HttpStatus.BAD_REQUEST,
      );
    }

    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MILLISECONDS);

    const tasks = await this.prisma.disputeExecutionTask.findMany({
      where: {
        complaint: { status: COMPLAINT_STATUS.CLOSED },
        OR: [
          { status: DISPUTE_EXECUTION_TASK_STATUS.PENDING },
          {
            status: DISPUTE_EXECUTION_TASK_STATUS.FAILED,
            updatedAt: {
              lte: new Date(now.getTime() - RETRY_DELAY_MILLISECONDS),
            },
          },
          {
            status: DISPUTE_EXECUTION_TASK_STATUS.PROCESSING,
            updatedAt: { lte: staleBefore },
          },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: { id: true, status: true },
    });
    const staleTaskIds = tasks
      .filter((task) => task.status === DISPUTE_EXECUTION_TASK_STATUS.PROCESSING)
      .map((task) => task.id);

    if (staleTaskIds.length > 0) {
      await this.prisma.disputeExecutionTask.updateMany({
        where: {
          id: { in: staleTaskIds },
          status: DISPUTE_EXECUTION_TASK_STATUS.PROCESSING,
          updatedAt: { lte: staleBefore },
        },
        data: {
          status: DISPUTE_EXECUTION_TASK_STATUS.PENDING,
          failureReason: "任务处理超时，已恢复等待执行",
          updatedAt: now,
        },
      });
    }

    return Promise.all(tasks.map((task) => this.executeTask(task.id)));
  }

  /** 分页返回指定投诉的内部执行任务。 */
  async findTasks(
    complaintId: string,
    page = 1,
    pageSize = 100,
  ): Promise<DisputeExecutionTaskListResponse> {
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(pageSize) ||
      page < 1 ||
      pageSize < 1 ||
      pageSize > MAX_BATCH_SIZE
    ) {
      throw new ApiException(
        "INVALID_PAGINATION",
        "分页参数必须为正整数且每页不超过 100 条",
        HttpStatus.BAD_REQUEST,
      );
    }

    const where = { complaintId };
    const [tasks, total] = await Promise.all([
      this.prisma.disputeExecutionTask.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { complaint: { select: { orderId: true } } },
      }),
      this.prisma.disputeExecutionTask.count({ where }),
    ]);

    return {
      list: tasks.map((task) => this.toView(task)),
      total,
      page,
      pageSize,
    };
  }

  /** 在任务完成事务中幂等写入信用变动；金额计划由不可变裁决承载。 */
  private async applyEffect(
    transaction: Prisma.TransactionClient,
    task: ExecutionTaskRecord,
    now: Date,
  ): Promise<void> {
    const payload = this.parsePayload(task.payload);

    if (task.taskType === "refund" || task.taskType === "settlement") {
      if (
        typeof payload.userId !== "string" ||
        !Number.isInteger(payload.amount) ||
        (payload.amount as number) < 0
      ) {
        throw new Error("Invalid money execution payload");
      }

      return;
    }

    if (
      (task.taskType !== "complainant_credit" && task.taskType !== "respondent_credit") ||
      typeof payload.userId !== "string" ||
      !Number.isInteger(payload.delta)
    ) {
      throw new Error("Invalid credit execution payload");
    }

    const inserted = await transaction.creditRecord.createMany({
      data: [
        {
          userId: payload.userId,
          changeAmount: payload.delta as number,
          reason: "投诉裁决信用分调整",
          relatedOrderId: task.complaint.orderId,
          businessReference: task.idempotencyKey,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count === 0) {
      return;
    }

    await transaction.creditScore.upsert({
      where: { userId: payload.userId },
      create: {
        userId: payload.userId,
        creditScore: 100 + (payload.delta as number),
        lastUpdated: now,
      },
      update: {
        creditScore: { increment: payload.delta as number },
        lastUpdated: now,
      },
    });
  }

  /** 解析并校验任务载荷必须是 JSON 对象。 */
  private parsePayload(payload: string | null): Record<string, unknown> {
    if (!payload) {
      throw new Error("Execution task payload is missing");
    }

    const parsed: unknown = JSON.parse(payload);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Execution task payload must be an object");
    }

    return parsed as Record<string, unknown>;
  }

  /** 将未知异常压缩为可安全展示的失败摘要。 */
  private failureReason(error: unknown): string {
    const message = error instanceof Error ? error.message : "未知执行错误";

    return message.slice(0, 500);
  }

  /** 查询执行任务及其信用流水所需的订单引用。 */
  private async findTask(taskId: string): Promise<ExecutionTaskRecord> {
    const task = await this.prisma.disputeExecutionTask.findUnique({
      where: { id: taskId },
      include: { complaint: { select: { orderId: true } } },
    });

    if (!task) {
      throw new ApiException("RESOURCE_NOT_FOUND", "执行任务不存在", HttpStatus.NOT_FOUND);
    }

    return task;
  }

  /** 将数据库任务转换为共享客户端视图。 */
  private toView(task: ExecutionTaskRecord): DisputeExecutionTaskView {
    return {
      id: task.id,
      complaintId: task.complaintId,
      decisionLevel: task.decisionLevel as DecisionLevel,
      taskType: task.taskType as DisputeExecutionTaskType,
      status: task.status as DisputeExecutionTaskStatus,
      failureReason: task.failureReason,
      retryCount: task.retryCount,
      nextRetryAt:
        task.status === DISPUTE_EXECUTION_TASK_STATUS.FAILED
          ? new Date(task.updatedAt.getTime() + RETRY_DELAY_MILLISECONDS).toISOString()
          : null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
