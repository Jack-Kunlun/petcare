import { HttpStatus } from "@nestjs/common";
import { COMPLAINT_STATUS } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ComplaintCommandService } from "./complaint-command.service";

function serializationFailure(): Error & { code: string } {
  return Object.assign(new Error("transaction write conflict"), { code: "P2034" });
}

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
    user: {
      findFirst: jest.fn(),
    },
    complaintAssignment: { create: jest.fn() },
    complaintEvent: { create: jest.fn() },
  };
  const prisma = {
    order: { findUnique: jest.fn() },
    complaint: { findFirst: jest.fn() },
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
    jest.resetAllMocks();
    jest.useRealTimers();
    prisma.$transaction.mockImplementation((callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    );
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
    transaction.user.findFirst.mockResolvedValue({ id: "admin-2" });
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

  it("rechecks after P2034 and retries the whole create transaction", async () => {
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(serializationFailure()))
      .mockImplementationOnce((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      );
    prisma.complaint.findFirst.mockResolvedValue(null);

    await expect(service.createComplaint("owner-1", validRequest)).resolves.toBe("complaint-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.complaint.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: { notIn: [COMPLAINT_STATUS.CLOSED, COMPLAINT_STATUS.WITHDRAWN] },
      },
      select: { id: true },
    });
  });

  it("maps P2034 to an open complaint when the recheck finds one", async () => {
    prisma.$transaction.mockImplementationOnce(() => Promise.reject(serializationFailure()));
    prisma.complaint.findFirst.mockResolvedValue({ id: "complaint-open" });

    await expect(service.createComplaint("owner-1", validRequest)).rejects.toMatchObject({
      code: "OPEN_COMPLAINT_EXISTS",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("maps exhausted P2034 retries to OPEN_COMPLAINT_EXISTS", async () => {
    prisma.$transaction.mockImplementation(() => Promise.reject(serializationFailure()));
    prisma.complaint.findFirst.mockResolvedValue(null);

    await expect(service.createComplaint("owner-1", validRequest)).rejects.toMatchObject({
      code: "OPEN_COMPLAINT_EXISTS",
      status: HttpStatus.CONFLICT,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not swallow non-P2034 Prisma errors during create", async () => {
    const databaseError = Object.assign(new Error("database unavailable"), { code: "P1001" });

    prisma.$transaction.mockImplementationOnce(() => Promise.reject(databaseError));

    await expect(service.createComplaint("owner-1", validRequest)).rejects.toBe(databaseError);
    expect(prisma.complaint.findFirst).not.toHaveBeenCalled();
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

  it("allows exactly one administrator to win a concurrent claim", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: null,
      status: COMPLAINT_STATUS.UNASSIGNED,
      appealDeadlineAt: null,
      version: 2,
    });
    transaction.complaint.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      service.claim("complaint-1", { id: "admin-1", roles: ["complaint_admin"] }, 2),
      service.claim("complaint-1", { id: "admin-2", roles: ["complaint_admin"] }, 2),
    ]);

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(results[1]).toMatchObject({
      reason: { code: "COMPLAINT_STATE_CONFLICT" },
    });
    expect(transaction.complaintAssignment.create).toHaveBeenCalledTimes(1);
    expect(transaction.complaintEvent.create).toHaveBeenCalledTimes(1);
  });

  it("prevents an order-party administrator from claiming the complaint", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "admin-1",
      respondentId: "provider-1",
      assignedAdminId: null,
      status: COMPLAINT_STATUS.UNASSIGNED,
      appealDeadlineAt: null,
      version: 2,
    });

    await expect(
      service.claim("complaint-1", { id: "admin-1", roles: ["super_admin"] }, 2),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
    expect(transaction.complaint.updateMany).not.toHaveBeenCalled();
  });

  it("prevents an ordinary administrator from transferring another administrator's case", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.PROCESSING_INITIAL,
      appealDeadlineAt: null,
      version: 3,
    });

    await expect(
      service.transfer(
        "complaint-1",
        { id: "admin-2", roles: ["complaint_admin"] },
        "admin-3",
        "转交给当班管理员继续处理",
        3,
      ),
    ).rejects.toMatchObject({ code: "COMPLAINT_ACTION_NOT_ALLOWED" });
    expect(transaction.user.findFirst).not.toHaveBeenCalled();
  });

  it("allows a super administrator to override assignment and records the reason", async () => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.PROCESSING_FINAL,
      appealDeadlineAt: new Date("2026-08-04T12:00:00.000Z"),
      version: 4,
    });
    transaction.user.findFirst.mockResolvedValue({ id: "admin-3" });

    await service.transfer(
      "complaint-1",
      { id: "super-1", roles: ["super_admin"] },
      "admin-3",
      "原管理员临时离岗",
      4,
    );

    expect(transaction.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: "admin-3",
        status: "active",
        roles: {
          some: {
            role: {
              isActive: true,
              OR: [
                { roleName: "super_admin" },
                {
                  permissions: {
                    some: {
                      permission: { permissionCode: "dispute.resolve" },
                    },
                  },
                },
              ],
            },
          },
        },
      },
      select: { id: true },
    });
    expect(transaction.complaint.updateMany).toHaveBeenCalledWith({
      where: {
        id: "complaint-1",
        status: COMPLAINT_STATUS.PROCESSING_FINAL,
        version: 4,
      },
      data: {
        assignedAdminId: "admin-3",
        version: { increment: 1 },
      },
    });
    expect(transaction.complaintAssignment.create).toHaveBeenCalledWith({
      data: {
        complaintId: "complaint-1",
        assigneeAdminId: "admin-3",
        assignedByAdminId: "super-1",
      },
    });
    expect(transaction.complaintEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "transfer",
        payload: JSON.stringify({
          targetAdminId: "admin-3",
          reason: "原管理员临时离岗",
        }),
      }),
    });
  });

  it.each([
    ["complainant", "owner-1"],
    ["respondent", "provider-1"],
  ])("rejects transferring a complaint to its %s", async (_party, targetAdminId) => {
    transaction.complaint.findUnique.mockResolvedValue({
      id: "complaint-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      status: COMPLAINT_STATUS.PROCESSING_INITIAL,
      appealDeadlineAt: null,
      version: 3,
    });
    transaction.user.findFirst.mockResolvedValue({ id: targetAdminId });

    await expect(
      service.transfer(
        "complaint-1",
        { id: "admin-1", roles: ["complaint_admin"] },
        targetAdminId,
        "转交给其他处理员",
        3,
      ),
    ).rejects.toMatchObject({
      code: "COMPLAINT_PARTY_CANNOT_BE_ASSIGNEE",
      status: HttpStatus.BAD_REQUEST,
    });

    expect(transaction.user.findFirst).not.toHaveBeenCalled();
    expect(transaction.complaint.updateMany).not.toHaveBeenCalled();
    expect(transaction.complaintAssignment.create).not.toHaveBeenCalled();
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
