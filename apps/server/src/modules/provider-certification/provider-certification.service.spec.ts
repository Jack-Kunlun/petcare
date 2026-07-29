import { HttpStatus } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ProviderCertificationService } from "./provider-certification.service";

describe("ProviderCertificationService", () => {
  const applicationId = "11111111-1111-4111-8111-111111111111";
  const applicantId = "22222222-2222-4222-8222-222222222222";
  const reviewerId = "33333333-3333-4333-8333-333333333333";
  const transaction = {
    providerCertificationApplication: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    provider: { upsert: jest.fn() },
  };
  const prisma = {
    providerCertificationApplication: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  };
  const service = new ProviderCertificationService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns pending applications before completed applications", async () => {
    prisma.providerCertificationApplication.findMany.mockResolvedValue([]);
    prisma.providerCertificationApplication.count.mockResolvedValue(0);

    await service.findAdminPage({ page: 1, pageSize: 20 });

    expect(prisma.providerCertificationApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reviewedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      }),
    );
  });

  it("throws RESOURCE_NOT_FOUND when detail does not exist", async () => {
    prisma.providerCertificationApplication.findUnique.mockResolvedValue(null);

    await expect(service.findAdminDetail(applicationId)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      status: HttpStatus.NOT_FOUND,
    });
  });

  it("approves the application and provider in one transaction", async () => {
    const now = new Date("2026-07-29T12:00:00.000Z");

    transaction.providerCertificationApplication.findUnique.mockResolvedValue({
      applicantId,
      wechatScore: 680,
      trainingPassed: true,
    });
    transaction.providerCertificationApplication.updateMany.mockResolvedValue({ count: 1 });
    transaction.providerCertificationApplication.findUniqueOrThrow.mockResolvedValue({
      id: applicationId,
      realNameMasked: "张*",
      idCardMasked: "3601********1234",
      idCardFrontUrl: "https://example.com/front",
      idCardBackUrl: "https://example.com/back",
      wechatScore: 680,
      trainingPassed: true,
      status: "approved",
      rejectReason: null,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
      applicant: {
        id: applicantId,
        phone: "13800138000",
        username: null,
        nickname: "申请人",
        avatar: null,
      },
      reviewedBy: { id: reviewerId, nickname: "管理员" },
    });

    await service.approve(applicationId, reviewerId);

    expect(transaction.provider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: applicantId },
        update: expect.objectContaining({ certifiedSitter: true }),
      }),
    );
  });

  it("rejects a repeated review with REVIEW_CONFLICT", async () => {
    transaction.providerCertificationApplication.findUnique.mockResolvedValue({
      applicantId,
    });
    transaction.providerCertificationApplication.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.reject(applicationId, reviewerId, "资料不清晰")).rejects.toMatchObject({
      code: "REVIEW_CONFLICT",
      status: HttpStatus.CONFLICT,
    });
  });
});
