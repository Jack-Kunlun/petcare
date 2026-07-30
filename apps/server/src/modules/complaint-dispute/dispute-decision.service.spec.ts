import { HttpStatus } from "@nestjs/common";
import { COMPLAINT_STATUS, DECISION_LEVEL } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { DisputeDecisionService } from "./dispute-decision.service";

describe("DisputeDecisionService", () => {
  const transaction = {
    complaint: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    disputeDecision: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    complaintEvent: { create: jest.fn() },
    disputeExecutionTask: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  const service = new DisputeDecisionService(prisma as unknown as PrismaService);
  const validRequest = {
    liability: "respondent" as const,
    reason: "现有证据能够证明服务未按订单约定完成",
    refundAmount: 1000,
    settlementAmount: 2000,
    complainantCreditDelta: 0,
    respondentCreditDelta: -5,
    version: 3,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
    prisma.$transaction.mockImplementation((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    );
    transaction.complaint.findUnique.mockResolvedValue(
      complaintRecord({
        status: COMPLAINT_STATUS.PROCESSING_INITIAL,
        assignedAdminId: "admin-1",
        version: 3,
      }),
    );
    transaction.complaint.updateMany.mockResolvedValue({ count: 1 });
    transaction.disputeDecision.findUnique.mockResolvedValue(null);
    transaction.disputeDecision.create.mockResolvedValue({ id: "decision-1" });
  });

  it("sets the exact 72-hour appeal deadline and creates only non-zero execution tasks", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:00:00.000Z"));

    await service.decideInitial(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      validRequest,
    );

    expect(transaction.disputeDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId: "complaint-1",
        decisionAdminId: "admin-1",
        level: DECISION_LEVEL.INITIAL,
        reason: validRequest.reason,
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
      }),
      select: { id: true },
    });
    expect(transaction.complaint.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appealDeadlineAt: new Date("2026-08-04T12:00:00.000Z"),
          status: COMPLAINT_STATUS.INITIAL_DECIDED,
        }),
      }),
    );
    expect(transaction.disputeExecutionTask.create).toHaveBeenCalledTimes(3);
    expect(transaction.disputeExecutionTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "refund",
        idempotencyKey: "complaint-1:initial:refund",
      }),
    });
    expect(transaction.disputeExecutionTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "settlement",
        idempotencyKey: "complaint-1:initial:settlement",
      }),
    });
    expect(transaction.disputeExecutionTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "respondent_credit",
        idempotencyKey: "complaint-1:initial:respondent_credit",
      }),
    });
  });

  it("targets settlement to the service provider even when the provider filed the complaint", async () => {
    transaction.complaint.findUnique.mockResolvedValue(
      complaintRecord({
        complainantId: "provider-1",
        respondentId: "owner-1",
        order: { amount: 5000, providerId: "provider-1" },
      }),
    );

    await service.decideInitial(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      validRequest,
    );

    expect(transaction.disputeExecutionTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: "settlement",
        payload: JSON.stringify({ userId: "provider-1", amount: 2000 }),
      }),
    });
  });

  it("closes the complaint with an immutable final decision", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
    transaction.complaint.findUnique.mockResolvedValue(
      complaintRecord({
        status: COMPLAINT_STATUS.PROCESSING_FINAL,
        appealDeadlineAt: new Date("2026-08-04T12:00:00.000Z"),
        version: 5,
      }),
    );

    await service.decideFinal(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      { ...validRequest, version: 5 },
    );

    expect(transaction.disputeDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId: "complaint-1",
        level: DECISION_LEVEL.FINAL,
        createdAt: new Date("2026-08-05T12:00:00.000Z"),
      }),
      select: { id: true },
    });
    expect(transaction.complaint.updateMany).toHaveBeenCalledWith({
      where: {
        id: "complaint-1",
        status: COMPLAINT_STATUS.PROCESSING_FINAL,
        version: 5,
      },
      data: {
        status: COMPLAINT_STATUS.CLOSED,
        appealDeadlineAt: null,
        closedAt: new Date("2026-08-05T12:00:00.000Z"),
        version: { increment: 1 },
      },
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: {
        complaintId: "complaint-1",
        actorId: "admin-1",
        action: "final_decide",
        fromStatus: COMPLAINT_STATUS.PROCESSING_FINAL,
        toStatus: COMPLAINT_STATUS.CLOSED,
      },
    });
    expect(transaction.disputeExecutionTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotencyKey: "complaint-1:final:refund",
      }),
    });
  });

  it.each([
    [
      DECISION_LEVEL.INITIAL,
      COMPLAINT_STATUS.PROCESSING_INITIAL,
      (request: typeof validRequest) =>
        service.decideInitial(
          "complaint-1",
          { id: "admin-1", roles: ["complaint_admin"] },
          request,
        ),
    ],
    [
      DECISION_LEVEL.FINAL,
      COMPLAINT_STATUS.PROCESSING_FINAL,
      (request: typeof validRequest) =>
        service.decideFinal("complaint-1", { id: "admin-1", roles: ["complaint_admin"] }, request),
    ],
  ] as const)("rejects a duplicate %s decision", async (_level, status, decide) => {
    transaction.complaint.findUnique.mockResolvedValue(complaintRecord({ status }));
    transaction.disputeDecision.findUnique.mockResolvedValue({ id: "existing-decision" });

    await expect(decide(validRequest)).rejects.toMatchObject({
      code: "DUPLICATE_DISPUTE_DECISION",
    });
    expect(transaction.disputeDecision.create).not.toHaveBeenCalled();
    expect(transaction.complaint.updateMany).not.toHaveBeenCalled();
    expect(transaction.complaintEvent.create).not.toHaveBeenCalled();
    expect(transaction.disputeExecutionTask.create).not.toHaveBeenCalled();
  });

  it.each([
    ["negative refund", { refundAmount: -1 }],
    ["fractional refund", { refundAmount: 1.5 }],
    ["refund above order amount", { refundAmount: 5001, settlementAmount: 0 }],
    ["negative settlement", { settlementAmount: -1 }],
    ["fractional settlement", { settlementAmount: 1.5 }],
    ["amounts exceeding the order total", { refundAmount: 3001, settlementAmount: 2000 }],
    ["credit delta below minimum", { complainantCreditDelta: -101 }],
    ["credit delta above maximum", { respondentCreditDelta: 101 }],
    ["fractional credit delta", { respondentCreditDelta: 1.5 }],
  ])("rejects %s", async (_label, overrides) => {
    await expect(
      service.decideInitial(
        "complaint-1",
        { id: "admin-1", roles: ["complaint_admin"] },
        { ...validRequest, ...overrides },
      ),
    ).rejects.toMatchObject({
      code: "INVALID_DISPUTE_DECISION",
      status: HttpStatus.BAD_REQUEST,
    });
    expect(transaction.disputeDecision.create).not.toHaveBeenCalled();
    expect(transaction.complaint.updateMany).not.toHaveBeenCalled();
  });

  it("prevents an ordinary administrator from deciding another administrator's case", async () => {
    transaction.complaint.findUnique.mockResolvedValue(
      complaintRecord({ assignedAdminId: "admin-2" }),
    );

    await expect(
      service.decideInitial(
        "complaint-1",
        { id: "admin-1", roles: ["complaint_admin"] },
        validRequest,
      ),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
    expect(transaction.disputeDecision.create).not.toHaveBeenCalled();
  });

  it("allows a super administrator to override the current assignment", async () => {
    transaction.complaint.findUnique.mockResolvedValue(
      complaintRecord({ assignedAdminId: "admin-2" }),
    );

    await expect(
      service.decideInitial("complaint-1", { id: "super-1", roles: ["super_admin"] }, validRequest),
    ).resolves.toBe("complaint-1");
    expect(transaction.disputeDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ decisionAdminId: "super-1" }),
      select: { id: true },
    });
  });

  it("prevents even a super administrator from deciding an order-party case", async () => {
    transaction.complaint.findUnique.mockResolvedValue(
      complaintRecord({ complainantId: "super-1", assignedAdminId: "super-1" }),
    );

    await expect(
      service.decideInitial("complaint-1", { id: "super-1", roles: ["super_admin"] }, validRequest),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
    expect(transaction.disputeDecision.create).not.toHaveBeenCalled();
  });

  it("propagates a task failure so the enclosing transaction can roll back every write", async () => {
    const taskFailure = new Error("task insert failed");

    transaction.disputeExecutionTask.create
      .mockResolvedValueOnce({ id: "task-1" })
      .mockRejectedValueOnce(taskFailure);

    await expect(
      service.decideInitial(
        "complaint-1",
        { id: "admin-1", roles: ["complaint_admin"] },
        validRequest,
      ),
    ).rejects.toBe(taskFailure);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.disputeDecision.create).toHaveBeenCalled();
    expect(transaction.complaint.updateMany).toHaveBeenCalled();
    expect(transaction.complaintEvent.create).toHaveBeenCalled();
    expect(transaction.disputeExecutionTask.create).toHaveBeenCalled();
  });

  function complaintRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.PROCESSING_INITIAL,
      appealDeadlineAt: null,
      version: 3,
      order: { amount: 5000, providerId: "provider-1" },
      ...overrides,
    };
  }
});
