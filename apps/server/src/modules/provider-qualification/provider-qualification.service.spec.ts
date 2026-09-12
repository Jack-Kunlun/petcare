import { PROVIDER_QUALIFICATION_CONSENT_VERSION } from "@petcare/shared-types";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ProviderQualificationService } from "./provider-qualification.service";
import { QualificationStorage } from "./qualification-storage";

jest.mock("../website-content/media/website-media-file", () => ({
  validateWebsiteMediaFile: jest.fn().mockResolvedValue({ mimeType: "image/png" }),
}));

describe("ProviderQualificationService", () => {
  const applicantId = "11111111-1111-4111-8111-111111111111";
  const reviewerId = "22222222-2222-4222-8222-222222222222";
  const id = "33333333-3333-4333-8333-333333333333";
  const date = new Date("2026-09-12T00:00:00.000Z");
  const application = {
    id,
    applicantId,
    idempotencyKey: "44444444-4444-4444-8444-444444444444",
    status: "pending",
    idCardFrontKey: "private/provider-qualifications/front",
    idCardBackKey: "private/provider-qualifications/back",
    trainingKey: "private/provider-qualifications/training",
    idCardFrontMime: "image/png",
    idCardBackMime: "image/png",
    trainingMime: "image/png",
    consentVersion: PROVIDER_QUALIFICATION_CONSENT_VERSION,
    consentedAt: date,
    reviewReason: null,
    revokeReason: null,
    reviewedById: null,
    reviewedAt: null,
    verificationMethod: null,
    verificationReference: null,
    revokedById: null,
    revokedAt: null,
    purgeAfter: null,
    purgedAt: null,
    createdAt: date,
    updatedAt: date,
  };
  const tx = {
    $queryRaw: jest.fn(),
    user: { findFirst: jest.fn(), update: jest.fn() },
    provider: { upsert: jest.fn(), updateMany: jest.fn() },
    providerQualificationApplication: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    providerQualificationEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    providerQualificationApplication: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    providerQualificationEvent: { create: jest.fn(), findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const storage = { createKey: jest.fn(), put: jest.fn(), read: jest.fn(), delete: jest.fn() };
  const service = new ProviderQualificationService(
    prisma as unknown as PrismaService,
    storage as unknown as QualificationStorage,
    { qualificationStorage: null } as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.$queryRaw.mockResolvedValue([{ id: applicantId }]);
    tx.providerQualificationApplication.findUnique.mockResolvedValue(application);
    tx.providerQualificationApplication.update.mockResolvedValue(application);
    tx.providerQualificationApplication.updateMany.mockResolvedValue({ count: 1 });
    tx.providerQualificationApplication.findUniqueOrThrow.mockResolvedValue(application);
    tx.providerQualificationEvent.create.mockResolvedValue({});
    tx.user.findFirst.mockResolvedValue({ id: applicantId });
    tx.provider.updateMany.mockResolvedValue({ count: 1 });
    prisma.providerQualificationApplication.findUnique.mockResolvedValue(application);
    prisma.providerQualificationApplication.findMany.mockResolvedValue([application]);
    prisma.providerQualificationEvent.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ nickname: "申请人", phone: "13800000000" });
    storage.createKey.mockReturnValue("private/provider-qualifications/new-key");
    storage.read.mockResolvedValue(Buffer.from("image"));
  });

  it("replays a draft key without creating another application or qualification", async () => {
    tx.providerQualificationApplication.findUnique.mockResolvedValue(application);
    await expect(
      service.createDraft(applicantId, application.idempotencyKey),
    ).resolves.toMatchObject({ id, status: "pending" });
    expect(tx.providerQualificationApplication.create).not.toHaveBeenCalled();
    expect(tx.provider.upsert).not.toHaveBeenCalled();
  });

  it("requires all private materials and affirmative current consent before submission", async () => {
    tx.providerQualificationApplication.findFirst.mockResolvedValue({
      ...application,
      status: "draft",
      trainingKey: null,
      purgeAfter: new Date("2099-01-01"),
    });
    await expect(
      service.submit(applicantId, id, PROVIDER_QUALIFICATION_CONSENT_VERSION, true),
    ).rejects.toMatchObject({ code: "QUALIFICATION_MATERIAL_INCOMPLETE" });
    await expect(
      service.submit(applicantId, id, PROVIDER_QUALIFICATION_CONSENT_VERSION, false),
    ).rejects.toMatchObject({ code: "QUALIFICATION_CONSENT_REQUIRED" });
    expect(tx.providerQualificationApplication.update).not.toHaveBeenCalled();
  });

  it("never permits self-review or approval without a verification reference", async () => {
    await expect(
      service.review(applicantId, id, "approve", "材料符合要求", "线下核验", "reference-1"),
    ).rejects.toMatchObject({ code: "QUALIFICATION_SELF_REVIEW" });
    await expect(service.review(reviewerId, id, "approve", "材料符合要求")).rejects.toMatchObject({
      code: "QUALIFICATION_VERIFICATION_REQUIRED",
    });
    await expect(
      service.review(reviewerId, id, "approve", "材料符合要求", "   ", "  "),
    ).rejects.toMatchObject({
      code: "QUALIFICATION_VERIFICATION_REQUIRED",
    });
    expect(tx.provider.upsert).not.toHaveBeenCalled();
  });

  it("records independent approval and all eligibility fields in one transaction", async () => {
    await service.review(reviewerId, id, "approve", "核验材料有效", "线下核验", "record-123");
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: applicantId },
      data: { userType: "provider" },
    });
    expect(tx.provider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { idCardVerified: true, trainingPassed: true, certifiedSitter: true },
      }),
    );
    expect(tx.providerQualificationApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          reviewedById: reviewerId,
          verificationReference: "record-123",
        }),
      }),
    );
    expect(tx.providerQualificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "approved", actorId: reviewerId }),
      }),
    );
  });

  it("revokes the projected flags and rejects replayed revocation", async () => {
    tx.providerQualificationApplication.findUnique.mockResolvedValue({
      ...application,
      status: "approved",
    });
    await service.revoke(reviewerId, id, "核验凭证已失效");
    expect(tx.provider.updateMany).toHaveBeenCalledWith({
      where: { userId: applicantId },
      data: { idCardVerified: false, trainingPassed: false, certifiedSitter: false },
    });
    expect(tx.providerQualificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "revoked", fromStatus: "approved" }),
      }),
    );
    tx.providerQualificationApplication.findUnique.mockResolvedValue({
      ...application,
      status: "revoked",
    });
    await expect(service.revoke(reviewerId, id, "重复撤销操作")).rejects.toMatchObject({
      code: "QUALIFICATION_STATE_CONFLICT",
    });
  });

  it("keeps private coordinates out of summaries and audits material reads", async () => {
    const summary = await service.mine(applicantId);

    expect(summary[0]).not.toHaveProperty("idCardFrontKey");
    const material = await service.materialForAdmin(reviewerId, id, "id-front");

    expect(material.body).toEqual(Buffer.from("image"));
    expect(prisma.providerQualificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: reviewerId, action: "read_id-front" }),
      }),
    );
    expect(await service.detailForAdmin(id)).not.toHaveProperty("idCardFrontKey");
  });

  it("deletes expired rejected objects before clearing their keys and keeps retry evidence", async () => {
    const rejected = { ...application, status: "rejected", purgeAfter: new Date("2020-01-01") };

    prisma.providerQualificationApplication.findMany.mockResolvedValue([rejected]);
    prisma.providerQualificationApplication.findUnique.mockResolvedValue(rejected);

    await expect(service.purgeExpired()).resolves.toBe(1);
    expect(storage.delete).toHaveBeenCalledTimes(3);
    expect(tx.providerQualificationApplication.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idCardFrontKey: null,
          idCardBackKey: null,
          trainingKey: null,
        }),
      }),
    );
    expect(tx.providerQualificationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "materials_purged" }),
      }),
    );

    storage.delete.mockRejectedValueOnce(new Error("private storage unavailable"));
    await expect(service.purgeExpired()).resolves.toBe(0);
    expect(tx.providerQualificationApplication.updateMany).toHaveBeenCalledTimes(1);
  });
});
