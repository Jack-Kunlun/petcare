import { COMPLAINT_ACTION, COMPLAINT_STATUS } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ComplaintQueryService } from "./complaint-query.service";

describe("ComplaintQueryService", () => {
  const prisma = {
    complaint: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new ComplaintQueryService(prisma as unknown as PrismaService);
  const createdAt = new Date("2026-07-29T00:00:00.000Z");
  const updatedAt = new Date("2026-07-30T00:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the current user's complaints in the standard page shape", async () => {
    prisma.complaint.findMany.mockResolvedValue([
      {
        id: "complaint-1",
        orderId: "order-1",
        complainantId: "owner-1",
        respondentId: "provider-1",
        status: COMPLAINT_STATUS.PENDING_RESPONSE,
        assignedAdminId: null,
        createdAt,
        updatedAt,
      },
    ]);
    prisma.complaint.count.mockResolvedValue(1);

    const result = await service.findMine("owner-1", 1, 20);

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ complainantId: "owner-1" }, { respondentId: "owner-1" }],
        },
      }),
    );
    expect(result).toEqual({
      list: [
        expect.objectContaining({
          id: "complaint-1",
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns the filtered administrator complaint page in the standard shape", async () => {
    prisma.complaint.findMany.mockResolvedValue([
      {
        id: "complaint-1",
        orderId: "order-1",
        complainantId: "owner-1",
        respondentId: "provider-1",
        status: COMPLAINT_STATUS.PROCESSING_INITIAL,
        assignedAdminId: "admin-1",
        createdAt,
        updatedAt,
      },
    ]);
    prisma.complaint.count.mockResolvedValue(1);

    const result = await service.findAdminPage({
      page: 2,
      pageSize: 10,
      status: COMPLAINT_STATUS.PROCESSING_INITIAL,
      keyword: " owner ",
      handlerId: "admin-1",
    });

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: COMPLAINT_STATUS.PROCESSING_INITIAL,
          assignedAdminId: "admin-1",
          OR: [
            { orderId: { contains: "owner", mode: "insensitive" } },
            {
              complainant: {
                is: {
                  OR: [
                    { id: { contains: "owner", mode: "insensitive" } },
                    { phone: { contains: "owner" } },
                    { username: { contains: "owner", mode: "insensitive" } },
                    { nickname: { contains: "owner", mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              respondent: {
                is: {
                  OR: [
                    { id: { contains: "owner", mode: "insensitive" } },
                    { phone: { contains: "owner" } },
                    { username: { contains: "owner", mode: "insensitive" } },
                    { nickname: { contains: "owner", mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({
      list: [expect.objectContaining({ id: "complaint-1", handlerId: "admin-1" })],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  it.each([
    ["page below one", 0, 20],
    ["page size below one", 1, 0],
    ["page size above one hundred", 1, 101],
  ])("rejects %s", async (_label, page, pageSize) => {
    await expect(service.findMine("owner-1", page, pageSize)).rejects.toMatchObject({
      code: "INVALID_PAGINATION",
    });
    expect(prisma.complaint.findMany).not.toHaveBeenCalled();
  });

  it("rejects detail access by a user outside the order parties", async () => {
    prisma.complaint.findUnique.mockResolvedValue(
      complaintRecord({ status: COMPLAINT_STATUS.PENDING_RESPONSE }),
    );

    await expect(service.findForUser("complaint-1", "stranger-1", updatedAt)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
  });

  it("serializes detail dates and exposes statements, decisions, and events", async () => {
    prisma.complaint.findUnique.mockResolvedValue(
      complaintRecord({
        status: COMPLAINT_STATUS.INITIAL_DECIDED,
        appealDeadlineAt: new Date("2026-08-01T00:00:00.000Z"),
        decisions: [
          {
            level: "initial",
            liability: "respondent",
            reason: "现有证据表明服务未按订单约定完成",
            refundAmount: 1000,
            settlementAmount: 2000,
            complainantCreditDelta: 0,
            respondentCreditDelta: -5,
            createdAt,
          },
        ],
      }),
    );

    const result = await service.findForUser("complaint-1", "owner-1", updatedAt);

    expect(result).toMatchObject({
      complaintType: "service_quality",
      expectedSolution: "申请部分退款",
      reason: "服务过程与约定不符",
      evidenceUrls: ["https://cdn.example/initial.jpg"],
      respondentStatement: "实际服务已按约定完成",
      respondentEvidenceUrls: ["https://cdn.example/response.jpg"],
      initialDecision: {
        liability: "respondent",
        refundAmount: 1000,
        version: 4,
      },
      finalDecision: null,
      secondAppealDeadline: "2026-08-01T00:00:00.000Z",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      statements: [
        expect.objectContaining({ createdAt: createdAt.toISOString() }),
        expect.objectContaining({ createdAt: updatedAt.toISOString() }),
      ],
      events: [expect.objectContaining({ createdAt: createdAt.toISOString() })],
    });
  });

  it("computes second appeal availability for the current viewer", async () => {
    prisma.complaint.findUnique.mockResolvedValue(
      complaintRecord({
        status: COMPLAINT_STATUS.PROCESSING_FINAL,
        appealDeadlineAt: new Date("2026-08-01T00:00:00.000Z"),
        statements: [
          ...baseStatements,
          {
            id: "appeal-provider",
            stage: "second_appeal",
            authorId: "provider-1",
            statement: "被投诉方已申诉",
            evidenceUrls: [],
            createdAt: updatedAt,
          },
        ],
      }),
    );

    const ownerView = await service.findForUser(
      "complaint-1",
      "owner-1",
      new Date("2026-07-31T00:00:00.000Z"),
    );
    const providerView = await service.findForUser(
      "complaint-1",
      "provider-1",
      new Date("2026-07-31T00:00:00.000Z"),
    );

    expect(ownerView.allowedActions).toContain(COMPLAINT_ACTION.SECOND_APPEAL);
    expect(providerView.allowedActions).not.toContain(COMPLAINT_ACTION.SECOND_APPEAL);
  });

  it("maps administrator detail and computes assignment-sensitive actions", async () => {
    prisma.complaint.findUnique.mockResolvedValue(
      complaintRecord({
        status: COMPLAINT_STATUS.PROCESSING_INITIAL,
        assignedAdminId: "admin-1",
      }),
    );

    const assignedView = await service.findForAdmin(
      "complaint-1",
      { id: "admin-1", roles: ["complaint_admin"] },
      updatedAt,
    );
    const superView = await service.findForAdmin(
      "complaint-1",
      { id: "admin-2", roles: ["super_admin"] },
      updatedAt,
    );

    expect(assignedView.allowedActions).toEqual([
      COMPLAINT_ACTION.TRANSFER,
      COMPLAINT_ACTION.INITIAL_DECIDE,
    ]);
    expect(superView.allowedActions).toEqual([
      COMPLAINT_ACTION.TRANSFER,
      COMPLAINT_ACTION.INITIAL_DECIDE,
    ]);
    expect(assignedView).toMatchObject({
      id: "complaint-1",
      handlerId: "admin-1",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  const baseStatements = [
    {
      id: "statement-initial",
      stage: "initial",
      authorId: "owner-1",
      statement: "服务过程与约定不符",
      evidenceUrls: ["https://cdn.example/initial.jpg"],
      createdAt,
    },
    {
      id: "statement-response",
      stage: "response",
      authorId: "provider-1",
      statement: "实际服务已按约定完成",
      evidenceUrls: ["https://cdn.example/response.jpg"],
      createdAt: updatedAt,
    },
  ];

  function complaintRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "complaint-1",
      orderId: "order-1",
      complainantId: "owner-1",
      respondentId: "provider-1",
      assignedAdminId: "admin-1",
      complaintType: "service_quality",
      expectedSolution: "申请部分退款",
      status: COMPLAINT_STATUS.PENDING_RESPONSE,
      appealDeadlineAt: null,
      version: 4,
      createdAt,
      updatedAt,
      statements: baseStatements,
      decisions: [],
      events: [
        {
          id: "event-1",
          actorId: "owner-1",
          action: "create",
          fromStatus: null,
          toStatus: COMPLAINT_STATUS.PENDING_RESPONSE,
          payload: null,
          createdAt,
        },
      ],
      executionTasks: [],
      ...overrides,
    };
  }
});
