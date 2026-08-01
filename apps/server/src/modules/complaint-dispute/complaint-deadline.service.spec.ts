import { COMPLAINT_STATUS, DECISION_LEVEL } from "@petcare/shared-types";
import { AppLogger } from "../../logging/app-logger.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ComplaintDeadlineService } from "./complaint-deadline.service";
import { DisputeExecutionService } from "./dispute-execution.service";

describe("ComplaintDeadlineService", () => {
  const transaction = {
    complaint: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    disputeDecision: {
      upsert: jest.fn(),
    },
    disputeExecutionTask: {
      createMany: jest.fn(),
    },
    complaintEvent: {
      create: jest.fn(),
    },
  };
  const prisma = {
    complaint: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const executionService = {
    processDueTasks: jest.fn(),
  };
  const logger = { write: jest.fn() };
  const service = new ComplaintDeadlineService(
    prisma as unknown as PrismaService,
    executionService as unknown as DisputeExecutionService,
    logger as unknown as AppLogger,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => unknown) => callback(transaction),
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("closes an expired initial decision and only ensures its missing tasks", async () => {
    const now = new Date("2026-08-04T12:00:00.000Z");

    prisma.complaint.findMany.mockResolvedValue([{ id: "complaint-1", version: 3 }]);
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      status: COMPLAINT_STATUS.INITIAL_DECIDED,
      version: 3,
      appealDeadlineAt: new Date("2026-08-04T11:59:59.000Z"),
      order: { providerId: "provider-1" },
      decisions: [
        {
          id: "decision-initial",
          decisionAdminId: "admin-1",
          level: DECISION_LEVEL.INITIAL,
          liability: "respondent",
          reason: "服务未按订单约定完成",
          refundAmount: 1000,
          settlementAmount: 2000,
          complainantCreditDelta: 0,
          respondentCreditDelta: -5,
        },
      ],
    });
    transaction.complaint.updateMany.mockResolvedValue({ count: 1 });
    transaction.disputeExecutionTask.createMany.mockResolvedValue({ count: 3 });
    transaction.complaintEvent.create.mockResolvedValue({});

    await expect(service.closeExpiredAppealWindows(now)).resolves.toBe(1);

    expect(prisma.complaint.findMany).toHaveBeenCalledWith({
      where: {
        status: COMPLAINT_STATUS.INITIAL_DECIDED,
        appealDeadlineAt: { lte: now },
      },
      orderBy: { appealDeadlineAt: "asc" },
      take: 100,
      select: { id: true, version: true },
    });
    expect(transaction.complaint.updateMany).toHaveBeenCalledWith({
      where: {
        id: "complaint-1",
        status: COMPLAINT_STATUS.INITIAL_DECIDED,
        version: 3,
        appealDeadlineAt: { lte: now },
      },
      data: {
        status: COMPLAINT_STATUS.CLOSED,
        appealDeadlineAt: null,
        closedAt: now,
        version: { increment: 1 },
      },
    });
    expect(transaction.disputeDecision.upsert).not.toHaveBeenCalled();
    expect(transaction.disputeExecutionTask.createMany).toHaveBeenCalledWith({
      data: [
        {
          complaintId: "complaint-1",
          decisionId: "decision-initial",
          decisionLevel: DECISION_LEVEL.INITIAL,
          taskType: "refund",
          payload: JSON.stringify({ userId: "owner-1", amount: 1000 }),
          idempotencyKey: "complaint-1:initial:refund",
        },
        {
          complaintId: "complaint-1",
          decisionId: "decision-initial",
          decisionLevel: DECISION_LEVEL.INITIAL,
          taskType: "settlement",
          payload: JSON.stringify({ userId: "provider-1", amount: 2000 }),
          idempotencyKey: "complaint-1:initial:settlement",
        },
        {
          complaintId: "complaint-1",
          decisionId: "decision-initial",
          decisionLevel: DECISION_LEVEL.INITIAL,
          taskType: "respondent_credit",
          payload: JSON.stringify({ userId: "provider-1", delta: -5 }),
          idempotencyKey: "complaint-1:initial:respondent_credit",
        },
      ],
      skipDuplicates: true,
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: {
        complaintId: "complaint-1",
        actorId: null,
        action: "appeal_timeout_close",
        fromStatus: COMPLAINT_STATUS.INITIAL_DECIDED,
        toStatus: COMPLAINT_STATUS.CLOSED,
        payload: JSON.stringify({
          initialDecisionId: "decision-initial",
        }),
        createdAt: now,
      },
    });
  });

  it("does not copy a decision or tasks after losing the state-version claim", async () => {
    const now = new Date("2026-08-04T12:00:00.000Z");

    prisma.complaint.findMany.mockResolvedValue([{ id: "complaint-1", version: 3 }]);
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      status: COMPLAINT_STATUS.INITIAL_DECIDED,
      version: 3,
      appealDeadlineAt: new Date("2026-08-04T11:59:59.000Z"),
      order: { providerId: "provider-1" },
      decisions: [
        {
          id: "decision-initial",
          decisionAdminId: "admin-1",
          level: DECISION_LEVEL.INITIAL,
          liability: "respondent",
          reason: "服务未按订单约定完成",
          refundAmount: 1000,
          settlementAmount: 2000,
          complainantCreditDelta: 0,
          respondentCreditDelta: -5,
        },
      ],
    });
    transaction.complaint.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.closeExpiredAppealWindows(now)).resolves.toBe(0);

    expect(transaction.disputeDecision.upsert).not.toHaveBeenCalled();
    expect(transaction.disputeExecutionTask.createMany).not.toHaveBeenCalled();
    expect(transaction.complaintEvent.create).not.toHaveBeenCalled();
  });

  it("unrefs its maintenance timer and clears it during module destruction", () => {
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest.spyOn(global, "setInterval").mockReturnValue(timer);
    const clearIntervalSpy = jest.spyOn(global, "clearInterval").mockImplementation();

    service.onModuleInit();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(timer.unref).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledWith(timer);
  });

  it("runs one bounded deadline and execution batch per maintenance interval", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.complaint.findMany.mockResolvedValue([]);
    executionService.processDueTasks.mockResolvedValue([]);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    expect(executionService.processDueTasks).toHaveBeenCalledWith(100);
  });

  it("still consumes due tasks and logs when deadline closing fails", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T12:00:00.000Z"));
    prisma.complaint.findMany.mockRejectedValue(new Error("poison complaint"));
    executionService.processDueTasks.mockResolvedValue([]);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(executionService.processDueTasks).toHaveBeenCalledWith(100);
    expect(logger.write).toHaveBeenCalledWith("error", "complaint.deadline_maintenance_failed", {
      error: "poison complaint",
    });
  });
});
