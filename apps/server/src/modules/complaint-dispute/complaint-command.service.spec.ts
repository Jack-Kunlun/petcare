import { HttpStatus } from "@nestjs/common";
import { COMPLAINT_STATUS } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ComplaintCommandService } from "./complaint-command.service";

describe("ComplaintCommandService", () => {
  const transaction = {
    complaint: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    complaintStatement: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    complaintEvent: { create: jest.fn() },
  };
  const prisma = {
    order: { findUnique: jest.fn() },
    $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  const service = new ComplaintCommandService(prisma as unknown as PrismaService);
  const validRequest = {
    orderId: "order-1",
    complaintType: "service_quality",
    reason: "服务过程与约定不符",
    evidenceUrls: ["https://cdn.example/evidence.jpg"],
    expectedSolution: "申请部分退款",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      ownerId: "owner-1",
      providerId: "provider-1",
      status: "completed",
    });
    transaction.complaint.findFirst.mockResolvedValue(null);
    transaction.complaint.create.mockResolvedValue({ id: "complaint-1" });
    transaction.complaint.updateMany.mockResolvedValue({ count: 1 });
    transaction.complaintStatement.findUnique.mockResolvedValue(null);
  });

  it("creates a complaint for an order party and records the first event", async () => {
    await service.createComplaint("owner-1", validRequest);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(transaction.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order-1",
        complainantId: "owner-1",
        respondentId: "provider-1",
        status: COMPLAINT_STATUS.PENDING_RESPONSE,
      }),
      select: { id: true },
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId: "complaint-1",
        actorId: "owner-1",
        action: "create",
        fromStatus: null,
        toStatus: COMPLAINT_STATUS.PENDING_RESPONSE,
      }),
    });
  });

  it.each([
    ["not an order party", "stranger-1", "FORBIDDEN"],
    ["open complaint exists", "owner-1", "OPEN_COMPLAINT_EXISTS"],
  ])("rejects %s", async (label, actorId, code) => {
    if (label === "open complaint exists") {
      transaction.complaint.findFirst.mockResolvedValue({ id: "complaint-open" });
    }

    await expect(service.createComplaint(actorId, validRequest)).rejects.toMatchObject({ code });
  });

  it("records the first response and its transition event", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: null,
      status: COMPLAINT_STATUS.PENDING_RESPONSE,
      appealDeadlineAt: null,
      version: 1,
    });

    await service.respond("complaint-1", "provider-1", {
      statement: "实际服务已按约定完成",
      evidenceUrls: [],
      version: 1,
    });

    expect(transaction.complaintStatement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        complaintId: "complaint-1",
        authorId: "provider-1",
        stage: "response",
      }),
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "respond",
        fromStatus: COMPLAINT_STATUS.PENDING_RESPONSE,
        toStatus: COMPLAINT_STATUS.UNASSIGNED,
      }),
    });
  });

  it("rejects a repeated first response", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: null,
      status: COMPLAINT_STATUS.UNASSIGNED,
      appealDeadlineAt: null,
      version: 2,
    });

    await expect(
      service.respond("complaint-1", "provider-1", {
        statement: "重复回应",
        evidenceUrls: [],
        version: 2,
      }),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
  });

  it("rejects an empty first response", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: null,
      status: COMPLAINT_STATUS.PENDING_RESPONSE,
      appealDeadlineAt: null,
      version: 1,
    });

    await expect(
      service.respond("complaint-1", "provider-1", {
        statement: "  ",
        evidenceUrls: [],
        version: 1,
      }),
    ).rejects.toMatchObject({
      code: "COMPLAINT_RESPONSE_REQUIRED",
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it("allows each party to submit one second appeal before the deadline", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-30T00:00:00.000Z"));
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.INITIAL_DECIDED,
      appealDeadlineAt: new Date("2026-07-31T00:00:00.000Z"),
      version: 2,
      statements: [],
    });

    await service.submitSecondAppeal("complaint-1", "owner-1", {
      statement: "初裁忽略了服务现场记录",
      evidenceUrls: [],
      version: 2,
    });
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.PROCESSING_FINAL,
      appealDeadlineAt: new Date("2026-07-31T00:00:00.000Z"),
      version: 3,
      statements: [],
    });

    await service.submitSecondAppeal("complaint-1", "provider-1", {
      statement: "补充服务完成后的沟通记录",
      evidenceUrls: [],
      version: 3,
    });

    expect(transaction.complaintStatement.create).toHaveBeenCalledTimes(2);
  });

  it("rejects a repeated second appeal from the same party", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-30T00:00:00.000Z"));
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.PROCESSING_FINAL,
      appealDeadlineAt: new Date("2026-07-31T00:00:00.000Z"),
      version: 3,
      statements: [],
    });
    transaction.complaintStatement.findUnique.mockResolvedValue({ id: "appeal-1" });

    await expect(
      service.submitSecondAppeal("complaint-1", "owner-1", {
        statement: "重复申诉",
        evidenceUrls: [],
        version: 3,
      }),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
  });

  it("requires a new reason or a new evidence URL for a second appeal", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-30T00:00:00.000Z"));
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.INITIAL_DECIDED,
      appealDeadlineAt: new Date("2026-07-31T00:00:00.000Z"),
      version: 2,
      statements: [
        {
          statement: "服务过程与约定不符",
          evidenceUrls: ["https://cdn.example/evidence.jpg"],
        },
      ],
    });

    await expect(
      service.submitSecondAppeal("complaint-1", "owner-1", {
        statement: "服务过程与约定不符",
        evidenceUrls: ["https://cdn.example/evidence.jpg"],
        version: 2,
      }),
    ).rejects.toMatchObject({
      code: "NEW_APPEAL_MATERIAL_REQUIRED",
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it.each([
    COMPLAINT_STATUS.PENDING_RESPONSE,
    COMPLAINT_STATUS.UNASSIGNED,
    COMPLAINT_STATUS.PROCESSING_INITIAL,
  ])("allows the complainant to withdraw in %s", async (status) => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: status === COMPLAINT_STATUS.PROCESSING_INITIAL ? "admin-1" : null,
      status,
      appealDeadlineAt: null,
      version: 2,
    });

    await service.withdraw("complaint-1", "owner-1", 2);

    expect(transaction.complaint.updateMany).toHaveBeenCalledWith({
      where: { id: "complaint-1", status, version: 2 },
      data: {
        status: COMPLAINT_STATUS.WITHDRAWN,
        closedAt: expect.any(Date),
        version: { increment: 1 },
      },
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "withdraw",
        fromStatus: status,
        toStatus: COMPLAINT_STATUS.WITHDRAWN,
      }),
    });
  });

  it.each([
    ["at", "2026-07-31T00:00:00.000Z"],
    ["after", "2026-07-31T00:00:00.001Z"],
  ])("rejects a second appeal %s the deadline", async (_label, now) => {
    jest.useFakeTimers().setSystemTime(new Date(now));
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.INITIAL_DECIDED,
      appealDeadlineAt: new Date("2026-07-31T00:00:00.000Z"),
      version: 2,
      statements: [],
    });

    await expect(
      service.submitSecondAppeal("complaint-1", "owner-1", {
        statement: "补充申诉理由",
        evidenceUrls: [],
        version: 2,
      }),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
  });
});
