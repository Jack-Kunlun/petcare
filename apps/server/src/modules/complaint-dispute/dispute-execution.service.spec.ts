import { PrismaService } from "../../prisma/prisma.service";
import { DisputeExecutionService } from "./dispute-execution.service";

function taskRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "task-1",
    complaintId: "complaint-1",
    decisionId: "decision-1",
    decisionLevel: "final",
    taskType: "respondent_credit",
    payload: JSON.stringify({ userId: "provider-1", delta: -5 }),
    status: "pending",
    failureReason: null,
    retryCount: 0,
    idempotencyKey: "complaint-1:final:respondent_credit",
    completedAt: null,
    createdAt: new Date("2026-08-04T11:59:00.000Z"),
    updatedAt: new Date("2026-08-04T11:59:00.000Z"),
    complaint: { orderId: "order-1" },
    ...overrides,
  };
}

describe("DisputeExecutionService", () => {
  const transaction = {
    complaint: {
      findUnique: jest.fn(),
    },
    disputeExecutionTask: {
      updateMany: jest.fn(),
    },
    creditRecord: {
      createMany: jest.fn(),
    },
    disputeMoneyRecord: {
      createMany: jest.fn(),
    },
    creditScore: {
      upsert: jest.fn(),
    },
    complaintEvent: {
      create: jest.fn(),
    },
  };
  const prisma = {
    complaint: {
      findUnique: jest.fn(),
    },
    disputeExecutionTask: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    creditRecord: {
      createMany: jest.fn(),
    },
    creditScore: {
      update: jest.fn(),
    },
    complaintEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new DisputeExecutionService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => unknown) => callback(transaction),
    );
    transaction.complaint.findUnique.mockResolvedValue({
      status: "closed",
      decisions: [{ id: "decision-1", level: "final" }],
    });
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.complaint.findUnique.mockResolvedValue({ version: 3 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not apply an already succeeded task twice", async () => {
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(
      taskRecord({
        status: "succeeded",
        completedAt: new Date("2026-08-04T12:00:00.000Z"),
      }),
    );

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      id: "task-1",
      status: "succeeded",
    });

    expect(prisma.disputeExecutionTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.creditRecord.createMany).not.toHaveBeenCalled();
    expect(prisma.creditScore.update).not.toHaveBeenCalled();
  });

  it("writes one uniquely referenced credit record before changing the score", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(taskRecord());
    transaction.creditRecord.createMany.mockResolvedValue({ count: 1 });
    transaction.creditScore.upsert.mockResolvedValue({});
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    transaction.complaintEvent.create.mockResolvedValue({});

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      status: "succeeded",
      retryCount: 1,
      completedAt: "2026-08-04T12:00:00.000Z",
    });

    expect(transaction.disputeExecutionTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task-1", status: { in: ["pending", "failed"] } },
      data: {
        status: "processing",
        retryCount: { increment: 1 },
        failureReason: null,
        completedAt: null,
        updatedAt: new Date("2026-08-04T12:00:00.000Z"),
      },
    });
    expect(transaction.creditRecord.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "provider-1",
          changeAmount: -5,
          reason: "投诉裁决信用分调整",
          relatedOrderId: "order-1",
          businessReference: "complaint-1:final:respondent_credit",
        },
      ],
      skipDuplicates: true,
    });
    expect(transaction.creditScore.upsert).toHaveBeenCalledWith({
      where: { userId: "provider-1" },
      create: {
        userId: "provider-1",
        creditScore: 95,
        lastUpdated: new Date("2026-08-04T12:00:00.000Z"),
      },
      update: {
        creditScore: { increment: -5 },
        lastUpdated: new Date("2026-08-04T12:00:00.000Z"),
      },
    });
  });

  it("does not change credit again when the unique business reference already exists", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(taskRecord());
    transaction.creditRecord.createMany.mockResolvedValue({ count: 0 });
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    transaction.complaintEvent.create.mockResolvedValue({});

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      status: "succeeded",
      retryCount: 1,
    });

    expect(transaction.creditRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(transaction.creditScore.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["refund", "owner-1", 1000],
    ["settlement", "provider-1", 0],
  ])("writes an auditable idempotent %s money record", async (taskType, userId, amount) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(
      taskRecord({
        taskType,
        payload: JSON.stringify({ userId, amount }),
        idempotencyKey: `complaint-1:final:${taskType}`,
      }),
    );
    transaction.disputeMoneyRecord.createMany.mockResolvedValue({ count: 1 });

    await expect(service.executeTask("task-1")).resolves.toMatchObject({ status: "succeeded" });

    expect(transaction.disputeMoneyRecord.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId,
          orderId: "order-1",
          complaintId: "complaint-1",
          executionTaskId: "task-1",
          type: taskType,
          amount,
          businessReference: `complaint-1:final:${taskType}`,
        },
      ],
      skipDuplicates: true,
    });
  });

  it("treats an existing money business reference as an idempotent success", async () => {
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(
      taskRecord({
        taskType: "refund",
        payload: JSON.stringify({ userId: "owner-1", amount: 1000 }),
      }),
    );
    transaction.disputeMoneyRecord.createMany.mockResolvedValue({ count: 0 });

    await expect(service.executeTask("task-1")).resolves.toMatchObject({ status: "succeeded" });

    expect(transaction.disputeMoneyRecord.createMany).toHaveBeenCalledTimes(1);
  });

  it("does not mark a money task succeeded when its ledger write fails", async () => {
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(
      taskRecord({
        taskType: "refund",
        payload: JSON.stringify({ userId: "owner-1", amount: 1000 }),
      }),
    );
    transaction.disputeMoneyRecord.createMany.mockRejectedValue(
      new Error("money store unavailable"),
    );

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      status: "failed",
      failureReason: "money store unavailable",
    });

    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "execution_failed" }),
    });
    expect(transaction.disputeExecutionTask.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "succeeded" }) }),
    );
  });

  it("does not execute an effect after losing the conditional claim", async () => {
    prisma.disputeExecutionTask.findUnique
      .mockResolvedValueOnce(taskRecord())
      .mockResolvedValueOnce(taskRecord({ status: "processing" }));
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      status: "processing",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.creditScore.upsert).not.toHaveBeenCalled();
  });

  it("does not claim or apply a task until the complaint is closed", async () => {
    prisma.disputeExecutionTask.findUnique
      .mockResolvedValueOnce(taskRecord())
      .mockResolvedValueOnce(taskRecord());
    transaction.complaint.findUnique.mockResolvedValue({
      status: "initial_decided",
      decisions: [{ id: "decision-1", level: "initial" }],
    });

    await expect(service.executeTask("task-1")).resolves.toMatchObject({ status: "pending" });

    expect(transaction.disputeExecutionTask.updateMany).not.toHaveBeenCalled();
    expect(transaction.creditRecord.createMany).not.toHaveBeenCalled();
    expect(transaction.complaintEvent.create).not.toHaveBeenCalled();
  });

  it("supersedes an initial task when a final decision exists", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(
      taskRecord({ decisionId: "decision-initial", decisionLevel: "initial" }),
    );
    transaction.complaint.findUnique.mockResolvedValue({
      status: "closed",
      decisions: [
        { id: "decision-final", level: "final" },
        { id: "decision-initial", level: "initial" },
      ],
    });

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      status: "superseded",
      completedAt: "2026-08-04T12:00:00.000Z",
    });

    expect(transaction.disputeExecutionTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task-1", status: { in: ["pending", "failed"] } },
      data: {
        status: "superseded",
        failureReason: null,
        completedAt: new Date("2026-08-04T12:00:00.000Z"),
        updatedAt: new Date("2026-08-04T12:00:00.000Z"),
      },
    });
    expect(transaction.creditRecord.createMany).not.toHaveBeenCalled();
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: {
        complaintId: "complaint-1",
        actorId: null,
        action: "execution_superseded",
        payload: JSON.stringify({
          taskId: "task-1",
          taskType: "respondent_credit",
          reason: "newer_decision",
        }),
      },
    });
  });

  it("records failure metadata and exposes the next retry time", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(taskRecord());
    transaction.creditRecord.createMany.mockRejectedValue(new Error("credit store unavailable"));
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    transaction.complaintEvent.create.mockResolvedValue({});

    await expect(service.executeTask("task-1")).resolves.toMatchObject({
      status: "failed",
      failureReason: "credit store unavailable",
      retryCount: 1,
      nextRetryAt: "2026-08-04T12:01:00.000Z",
    });

    expect(transaction.disputeExecutionTask.updateMany).toHaveBeenCalledWith({
      where: { id: "task-1", status: { in: ["pending", "failed"] } },
      data: {
        status: "failed",
        retryCount: { increment: 1 },
        failureReason: "credit store unavailable",
        updatedAt: new Date("2026-08-04T12:00:00.000Z"),
      },
    });
  });

  it("recovers stale claims and processes only the requested due-task batch", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.disputeExecutionTask.findMany.mockResolvedValue([
      {
        id: "task-1",
        complaintId: "complaint-1",
        taskType: "respondent_credit",
        status: "processing",
      },
      {
        id: "task-2",
        complaintId: "complaint-1",
        taskType: "refund",
        status: "failed",
      },
    ]);
    prisma.disputeExecutionTask.findUnique
      .mockResolvedValueOnce(
        taskRecord({
          id: "task-1",
          status: "succeeded",
          completedAt: new Date("2026-08-04T11:59:30.000Z"),
        }),
      )
      .mockResolvedValueOnce(
        taskRecord({
          id: "task-2",
          status: "succeeded",
          completedAt: new Date("2026-08-04T11:59:40.000Z"),
        }),
      );

    await expect(service.processDueTasks(2)).resolves.toHaveLength(2);

    expect(transaction.disputeExecutionTask.updateMany).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        status: "processing",
        updatedAt: { lte: new Date("2026-08-04T11:55:00.000Z") },
      },
      data: {
        status: "pending",
        failureReason: "任务处理超时，已恢复等待执行",
        updatedAt: new Date("2026-08-04T12:00:00.000Z"),
      },
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: {
        complaintId: "complaint-1",
        actorId: null,
        action: "execution_recovered",
        payload: JSON.stringify({
          taskId: "task-1",
          fromStatus: "processing",
          toStatus: "pending",
          reason: "processing_timeout",
        }),
      },
    });
    expect(prisma.disputeExecutionTask.findMany).toHaveBeenCalledWith({
      where: {
        complaint: { status: "closed" },
        OR: [
          { status: "pending" },
          {
            status: "failed",
            updatedAt: { lte: new Date("2026-08-04T11:59:00.000Z") },
          },
          {
            status: "processing",
            updatedAt: { lte: new Date("2026-08-04T11:55:00.000Z") },
          },
        ],
      },
      orderBy: { updatedAt: "asc" },
      take: 2,
      select: { id: true, complaintId: true, taskType: true, status: true },
    });
  });

  it("queries closed complaints before applying the batch limit so open tasks cannot starve them", async () => {
    const closedTask = taskRecord({ id: "task-closed", status: "succeeded" });

    prisma.disputeExecutionTask.findMany.mockImplementation(
      async (query: { where?: { complaint?: { status?: string } } }) =>
        query.where?.complaint?.status === "closed"
          ? [{ id: "task-closed", status: "pending" }]
          : [
              { id: "task-open-1", status: "pending" },
              { id: "task-open-2", status: "pending" },
            ],
    );
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(closedTask);

    await expect(service.processDueTasks(2)).resolves.toEqual([
      expect.objectContaining({ id: "task-closed", status: "succeeded" }),
    ]);

    expect(prisma.disputeExecutionTask.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-closed" } }),
    );
  });

  it("rejects retry unless the task is failed and belongs to the requested complaint", async () => {
    prisma.disputeExecutionTask.findFirst.mockResolvedValue(null);

    await expect(
      service.retryTask("task-1", "admin-1", "complaint-other", 3),
    ).rejects.toMatchObject({
      code: "EXECUTION_TASK_NOT_RETRYABLE",
      status: 409,
    });

    expect(prisma.disputeExecutionTask.findFirst).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        complaintId: "complaint-other",
        status: "failed",
      },
      select: { id: true },
    });
    expect(prisma.disputeExecutionTask.updateMany).not.toHaveBeenCalled();
  });

  it("rejects retry when the complaint version is stale", async () => {
    prisma.complaint.findUnique.mockResolvedValue({ version: 4 });

    await expect(service.retryTask("task-1", "admin-1", "complaint-1", 3)).rejects.toMatchObject({
      code: "COMPLAINT_STATE_CONFLICT",
      status: 409,
    });

    expect(prisma.disputeExecutionTask.findFirst).not.toHaveBeenCalled();
  });

  it("records the administrator on a successful failed-task retry", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.disputeExecutionTask.findFirst.mockResolvedValue({ id: "task-1" });
    prisma.disputeExecutionTask.findUnique.mockResolvedValue(
      taskRecord({
        taskType: "refund",
        payload: JSON.stringify({ userId: "owner-1", amount: 1000 }),
        status: "failed",
        retryCount: 1,
      }),
    );
    prisma.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    transaction.disputeExecutionTask.updateMany.mockResolvedValue({ count: 1 });
    transaction.complaintEvent.create.mockResolvedValue({});

    await expect(service.retryTask("task-1", "admin-1", "complaint-1", 3)).resolves.toMatchObject({
      status: "succeeded",
      retryCount: 2,
    });

    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: {
        complaintId: "complaint-1",
        actorId: "admin-1",
        action: "execution_succeeded",
        payload: JSON.stringify({ taskId: "task-1", taskType: "refund" }),
      },
    });
  });

  it("returns execution tasks in the unified pagination shape", async () => {
    prisma.disputeExecutionTask.findMany.mockResolvedValue([taskRecord({ status: "failed" })]);
    prisma.disputeExecutionTask.count.mockResolvedValue(1);

    await expect(service.findTasks("complaint-1", 1, 20)).resolves.toMatchObject({
      list: [
        {
          id: "task-1",
          complaintId: "complaint-1",
          status: "failed",
          nextRetryAt: "2026-08-04T12:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });
});
