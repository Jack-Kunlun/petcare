import { HttpStatus } from "@nestjs/common";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_INTENT_STATUS,
  BOUNTY_SERVICE_TYPE,
  BOUNTY_STATUS,
} from "@petcare/shared-types";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { BountyFeatureGuard } from "./bounty.controller";
import { BountyService } from "./bounty.service";

const validEvidencePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

validEvidencePng.writeUInt32BE(32, 16);
validEvidencePng.writeUInt32BE(32, 20);

describe("BountyService", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    orderIntent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transaction = {
    $queryRaw: jest.fn(),
    pet: { findFirst: jest.fn() },
    systemConfigPointer: { findUnique: jest.fn() },
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    orderSop: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    orderIntent: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const config = { orderTimeoutDelayMs: 48 * 60 * 60 * 1000 } as ConfigService;
  const mediaStorage = {
    put: jest.fn(),
    head: jest.fn(),
    delete: jest.fn(),
    resolvePublicUrl: jest.fn(),
  };
  const service = new BountyService(prisma as unknown as PrismaService, config, mediaStorage);
  const now = new Date("2026-08-31T00:00:00.000Z");
  const serviceTime = "2026-09-03T00:00:00.000Z";
  const expiresAt = new Date("2026-09-02T00:00:00.000Z");
  const petId = "11111111-1111-4111-8111-111111111111";
  const bountyId = "22222222-2222-4222-8222-222222222222";
  const intentId = "33333333-3333-4333-8333-333333333333";
  const providerId = "44444444-4444-4444-8444-444444444444";
  const otherProviderId = "55555555-5555-4555-8555-555555555555";
  const input = {
    petId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime,
    amountCents: 5_000,
    address: "  上海市示例地址  ",
    remark: "  请换水  ",
  };
  const privateRow = {
    id: bountyId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime: new Date(serviceTime),
    amount: 5_000,
    status: BOUNTY_STATUS.OPEN,
    address: "上海市示例地址",
    remark: "请换水",
    createdAt: now,
    reward: { expireTime: expiresAt },
    pet: { id: petId, name: "米米", breed: "英短", photos: [] },
    provider: null,
  };
  const confirmedPrivateRow = {
    ...privateRow,
    status: BOUNTY_STATUS.CONFIRMED,
    provider: { id: providerId, nickname: "合格服务者", avatar: null },
  };
  const publicRow = {
    id: bountyId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime: new Date(serviceTime),
    amount: 5_000,
    status: BOUNTY_STATUS.OPEN,
    reward: { expireTime: expiresAt },
    owner: { nickname: "小萌", avatar: null },
    pet: { name: "米米", breed: "英短", photos: [] },
  };
  const intentOrder = {
    id: bountyId,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime: new Date(serviceTime),
    amount: 5_000,
    status: BOUNTY_STATUS.OPEN,
    address: "上海市示例地址",
    remark: "请换水",
    providerId: null,
    reward: { expireTime: expiresAt },
    owner: { nickname: "小萌", avatar: null },
    pet: { name: "米米", breed: "英短", photos: [] },
  };
  const pendingIntentRow = {
    id: intentId,
    intentStatus: BOUNTY_INTENT_STATUS.PENDING,
    createdAt: now,
    order: intentOrder,
  };
  const publishedSopSteps = Array.from({ length: 5 }, (_, index) => ({
    stepNumber: index + 1,
    stepName: `步骤${index + 1}`,
    instruction: `执行步骤${index + 1}`,
    expectedDurationMinutes: 2,
    minimumPhotoCount: 1,
    videoRequired: index === 2,
  }));
  const frozenSopSteps = publishedSopSteps.map((step) => ({
    id: `sop-step-${step.stepNumber}`,
    ...step,
    photos: step.stepNumber === 1 ? ["https://cdn.example.com/step-1.png"] : [],
    videos: [],
    completedAt: null as Date | null,
  }));
  let lockedBounty: {
    id: string;
    ownerId: string;
    providerId: string | null;
    status: string;
    expiresAt: Date;
  };
  let providerEligible: boolean;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    lockedBounty = {
      id: bountyId,
      ownerId: "owner-1",
      providerId: null,
      status: BOUNTY_STATUS.OPEN,
      expiresAt,
    };
    providerEligible = true;
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    transaction.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join(" ");

      if (sql.includes('INNER JOIN "order_rewards"')) {
        return Promise.resolve(lockedBounty ? [lockedBounty] : []);
      }

      if (sql.includes('INNER JOIN "providers"')) {
        return Promise.resolve(providerEligible ? [{ id: providerId }] : []);
      }

      if (sql.includes('FROM "orders" o')) {
        return Promise.resolve([
          {
            id: lockedBounty.id,
            ownerId: lockedBounty.ownerId,
            providerId: lockedBounty.providerId,
            status: lockedBounty.status,
          },
        ]);
      }

      return Promise.resolve([{ status: "active", phone: "13800000000" }]);
    });
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.systemConfigPointer.findUnique.mockResolvedValue({
      publishedVersion: {
        id: "sop-version-1",
        configKey: "sop",
        status: "published",
        sopSteps: publishedSopSteps,
        sopViolationRules: [],
      },
    });
    transaction.order.create.mockResolvedValue(privateRow);
    transaction.order.updateMany.mockResolvedValue({ count: 1 });
    transaction.order.findFirst.mockResolvedValue(confirmedPrivateRow);
    transaction.orderIntent.upsert.mockResolvedValue(pendingIntentRow);
    transaction.orderIntent.findFirst.mockResolvedValue({
      id: intentId,
      providerId,
      intentStatus: BOUNTY_INTENT_STATUS.PENDING,
    });
    transaction.orderIntent.update.mockResolvedValue({});
    transaction.orderIntent.updateMany.mockResolvedValue({ count: 1 });
    transaction.orderSop.findMany.mockResolvedValue(frozenSopSteps);
    transaction.orderSop.update.mockResolvedValue({
      ...frozenSopSteps[0],
      photos: [...frozenSopSteps[0].photos, "https://cdn.example.com/evidence.png"],
    });
    transaction.orderSop.updateMany.mockResolvedValue({ count: 1 });
    mediaStorage.put.mockResolvedValue({
      storageKey: "public/sop-media/2026/08/evidence.png",
      publicUrl: "https://cdn.example.com/evidence.png",
    });
    mediaStorage.delete.mockResolvedValue(undefined);
    prisma.order.count.mockResolvedValue(1);
    prisma.orderIntent.count.mockResolvedValue(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates the owned-pet order and exact-price reward atomically in integer cents", async () => {
    await expect(service.create("owner-1", input)).resolves.toEqual({
      id: bountyId,
      serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
      serviceTime,
      amountCents: 5_000,
      status: BOUNTY_STATUS.OPEN,
      address: "上海市示例地址",
      remark: "请换水",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      pet: { id: petId, name: "米米", breed: "英短", coverImage: null },
      provider: null,
    });
    expect(transaction.pet.findFirst).toHaveBeenCalledWith({
      where: { id: petId, ownerId: "owner-1" },
      select: { id: true },
    });
    expect(transaction.order.create).toHaveBeenCalledWith({
      data: {
        orderType: "reward",
        serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
        ownerId: "owner-1",
        petId,
        serviceTime: new Date(serviceTime),
        amount: 5_000,
        address: "上海市示例地址",
        remark: "请换水",
        status: BOUNTY_STATUS.OPEN,
        sopConfigVersionId: "sop-version-1",
        reward: {
          create: {
            rewardAmount: 5_000,
            priceRangeMin: 5_000,
            priceRangeMax: 5_000,
            expireTime: expiresAt,
          },
        },
        sops: {
          create: publishedSopSteps.map((step) => ({
            ...step,
            violationGuidance: "[]",
            photos: [],
            videos: [],
          })),
        },
      },
      select: expect.any(Object),
    });
  });

  it("refuses to create an order without one complete published SOP template", async () => {
    transaction.systemConfigPointer.findUnique.mockResolvedValueOnce(null);

    await expect(service.create("owner-1", input)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.SOP_CONFIG_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(transaction.order.create).not.toHaveBeenCalled();
  });

  it("hides a missing or cross-owner pet without issuing an order write", async () => {
    transaction.pet.findFirst.mockResolvedValue(null);

    await expect(service.create("owner-2", input)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
    expect(transaction.order.create).not.toHaveBeenCalled();
  });

  it("rejects invalid time, money, and control characters before opening a transaction", async () => {
    await expect(
      service.create("owner-1", { ...input, serviceTime: now.toISOString() }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.VALIDATION_FAILED });
    await expect(service.create("owner-1", { ...input, amountCents: 50.5 })).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.VALIDATION_FAILED,
    });
    await expect(
      service.create("owner-1", { ...input, address: "上海市\n隐藏地址" }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.VALIDATION_FAILED });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires the provider account type and every persisted qualification flag", async () => {
    const qualified = {
      phone: "13800000000",
      status: "active",
      userType: "provider",
      provider: {
        idCardVerified: true,
        trainingPassed: true,
        certifiedSitter: true,
      },
    };

    prisma.user.findUnique.mockResolvedValue(qualified);
    await expect(service.getProviderEligibility(providerId)).resolves.toEqual({ eligible: true });

    const ineligibleUsers = [
      { ...qualified, userType: "pet_owner" },
      { ...qualified, phone: null },
      { ...qualified, provider: null },
      { ...qualified, provider: { ...qualified.provider, idCardVerified: false } },
      { ...qualified, provider: { ...qualified.provider, trainingPassed: false } },
      { ...qualified, provider: { ...qualified.provider, certifiedSitter: false } },
    ];

    for (const user of ineligibleUsers) {
      prisma.user.findUnique.mockResolvedValueOnce(user);
    }

    await expect(
      Promise.all(ineligibleUsers.map(() => service.getProviderEligibility(providerId))),
    ).resolves.toEqual(ineligibleUsers.map(() => ({ eligible: false })));
  });

  it("returns the same intent for repeated qualified submissions without private fields", async () => {
    const first = await service.submitIntent(providerId, bountyId);
    const repeated = await service.submitIntent(providerId, bountyId);

    expect(first).toEqual(repeated);
    expect(first).toMatchObject({
      id: intentId,
      status: BOUNTY_INTENT_STATUS.PENDING,
      bounty: { id: bountyId, address: null, remark: null },
    });
    expect(transaction.orderIntent.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.orderIntent.upsert).toHaveBeenLastCalledWith({
      where: { orderId_providerId: { orderId: bountyId, providerId } },
      update: {},
      create: { orderId: bountyId, providerId, intentStatus: BOUNTY_INTENT_STATUS.PENDING },
      select: expect.any(Object),
    });

    const lockSql = transaction.$queryRaw.mock.calls
      .map(([strings]) => (strings as TemplateStringsArray).join(" "))
      .join(" ");

    expect(lockSql).toContain("FOR UPDATE OF o, r");
    expect(lockSql).toContain("FOR SHARE OF u, p");
    expect(lockSql).toContain("BTRIM(u.\"phone\") <> ''");
    expect(lockSql).toContain("u.\"user_type\" = 'provider'");
    expect(lockSql).toContain('p."certified_sitter" = TRUE');
  });

  it("rejects missing qualification, owner self-intent, and closed bounties deterministically", async () => {
    providerEligible = false;
    await expect(service.submitIntent(providerId, bountyId)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.PROVIDER_NOT_ELIGIBLE,
      status: HttpStatus.FORBIDDEN,
    });

    lockedBounty.ownerId = providerId;
    await expect(service.submitIntent(providerId, bountyId)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.OWN_BOUNTY_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });

    lockedBounty.ownerId = "owner-1";
    lockedBounty.status = BOUNTY_STATUS.CONFIRMED;
    await expect(service.submitIntent(providerId, bountyId)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.NOT_OPEN,
      status: HttpStatus.CONFLICT,
    });
    expect(transaction.orderIntent.upsert).not.toHaveBeenCalled();
  });

  it("keeps intent address private until that provider is confirmed", async () => {
    const confirmedIntent = {
      ...pendingIntentRow,
      intentStatus: BOUNTY_INTENT_STATUS.CONFIRMED,
      order: {
        ...intentOrder,
        providerId,
        status: BOUNTY_STATUS.CONFIRMED,
      },
    };

    prisma.orderIntent.findMany.mockResolvedValueOnce([pendingIntentRow]);
    await expect(
      service.findMyIntents(providerId, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      list: [{ bounty: { address: null, remark: null } }],
    });

    prisma.orderIntent.findMany.mockResolvedValueOnce([confirmedIntent]);
    await expect(
      service.findMyIntents(providerId, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      list: [{ bounty: { address: "上海市示例地址", remark: "请换水" } }],
    });
  });

  it("hides candidate lists from non-owners and returns public provider summaries to the owner", async () => {
    prisma.order.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.findOwnerIntents("owner-2", bountyId, { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.NOT_FOUND, status: HttpStatus.NOT_FOUND });

    prisma.order.findFirst.mockResolvedValueOnce({ id: bountyId });
    prisma.orderIntent.findMany.mockResolvedValueOnce([
      {
        id: intentId,
        intentStatus: BOUNTY_INTENT_STATUS.PENDING,
        createdAt: now,
        provider: { id: providerId, nickname: "合格服务者", avatar: null },
      },
    ]);
    await expect(
      service.findOwnerIntents("owner-1", bountyId, { page: 1, pageSize: 20 }),
    ).resolves.toMatchObject({
      list: [
        {
          id: intentId,
          status: BOUNTY_INTENT_STATUS.PENDING,
          provider: { id: providerId, nickname: "合格服务者" },
        },
      ],
    });
  });

  it("atomically confirms one provider, rejects competitors, and returns the owner order", async () => {
    await expect(service.confirmIntent("owner-1", bountyId, intentId)).resolves.toMatchObject({
      id: bountyId,
      status: BOUNTY_STATUS.CONFIRMED,
      provider: { id: providerId },
    });
    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: bountyId,
        ownerId: "owner-1",
        orderType: "reward",
        status: BOUNTY_STATUS.OPEN,
        providerId: null,
      },
      data: { providerId, status: BOUNTY_STATUS.CONFIRMED },
    });
    expect(transaction.orderIntent.update).toHaveBeenCalledWith({
      where: { id: intentId },
      data: { intentStatus: BOUNTY_INTENT_STATUS.CONFIRMED },
    });
    expect(transaction.orderIntent.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: bountyId,
        id: { not: intentId },
        intentStatus: BOUNTY_INTENT_STATUS.PENDING,
      },
      data: { intentStatus: BOUNTY_INTENT_STATUS.REJECTED },
    });
  });

  it("makes the winning confirmation replay-safe and rejects a different candidate", async () => {
    lockedBounty.providerId = providerId;
    lockedBounty.status = BOUNTY_STATUS.CONFIRMED;
    transaction.orderIntent.findFirst.mockResolvedValueOnce({
      id: intentId,
      providerId,
      intentStatus: BOUNTY_INTENT_STATUS.CONFIRMED,
    });

    await expect(service.confirmIntent("owner-1", bountyId, intentId)).resolves.toMatchObject({
      provider: { id: providerId },
    });
    expect(transaction.order.updateMany).not.toHaveBeenCalled();

    transaction.orderIntent.findFirst.mockResolvedValueOnce({
      id: "66666666-6666-4666-8666-666666666666",
      providerId: otherProviderId,
      intentStatus: BOUNTY_INTENT_STATUS.PENDING,
    });
    await expect(
      service.confirmIntent("owner-1", bountyId, "66666666-6666-4666-8666-666666666666"),
    ).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.CONFIRMATION_CONFLICT,
      status: HttpStatus.CONFLICT,
    });
  });

  it("turns a lost conditional claim or revoked candidate into a stable conflict", async () => {
    transaction.order.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.confirmIntent("owner-1", bountyId, intentId)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.CONFIRMATION_CONFLICT,
      status: HttpStatus.CONFLICT,
    });

    providerEligible = false;
    await expect(service.confirmIntent("owner-1", bountyId, intentId)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.PROVIDER_NOT_ELIGIBLE,
      status: HttpStatus.CONFLICT,
    });
  });

  it("lets only order parties read SOP and only the eligible provider execute it", async () => {
    const sopOrder = {
      id: bountyId,
      ownerId: "owner-1",
      providerId,
      status: BOUNTY_STATUS.CONFIRMED,
      sops: frozenSopSteps,
    };
    const qualifiedProvider = {
      phone: "13800000000",
      status: "active",
      userType: "provider",
      provider: { idCardVerified: true, trainingPassed: true, certifiedSitter: true },
    };

    prisma.order.findFirst.mockResolvedValueOnce(sopOrder);
    await expect(service.findSop("owner-1", bountyId)).resolves.toMatchObject({
      currentStepNumber: 1,
      canExecute: false,
    });

    prisma.order.findFirst.mockResolvedValueOnce(sopOrder);
    prisma.user.findUnique.mockResolvedValueOnce(qualifiedProvider);
    await expect(service.findSop(providerId, bountyId)).resolves.toMatchObject({
      currentStepNumber: 1,
      canExecute: true,
    });

    prisma.order.findFirst.mockResolvedValueOnce(null);
    await expect(service.findSop("other-user", bountyId)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  });

  it("validates, stores, and atomically appends evidence only to the current step", async () => {
    lockedBounty.providerId = providerId;
    lockedBounty.status = BOUNTY_STATUS.CONFIRMED;
    prisma.order.findFirst.mockResolvedValueOnce({
      id: bountyId,
      ownerId: "owner-1",
      providerId,
      status: BOUNTY_STATUS.CONFIRMED,
      sops: frozenSopSteps,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      phone: "13800000000",
      status: "active",
      userType: "provider",
      provider: { idCardVerified: true, trainingPassed: true, certifiedSitter: true },
    });

    const uploaded = await service.uploadSopEvidence(providerId, bountyId, 1, "photo", {
      buffer: validEvidencePng,
      originalName: "evidence.bin",
      mimeType: "application/octet-stream",
    });

    expect(uploaded.currentStepNumber).toBe(1);
    expect(uploaded.steps[0]?.photos).toContain("https://cdn.example.com/evidence.png");
    expect(mediaStorage.put).toHaveBeenCalledWith(
      expect.objectContaining({ area: "sop-media", mimeType: "image/png", extension: "png" }),
    );
    expect(transaction.orderSop.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { photos: { push: "https://cdn.example.com/evidence.png" } },
      }),
    );

    prisma.order.findFirst.mockResolvedValueOnce({
      id: bountyId,
      ownerId: "owner-1",
      providerId,
      status: BOUNTY_STATUS.CONFIRMED,
      sops: frozenSopSteps,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      phone: "13800000000",
      status: "active",
      userType: "provider",
      provider: { idCardVerified: true, trainingPassed: true, certifiedSitter: true },
    });
    await expect(
      service.uploadSopEvidence(providerId, bountyId, 2, "photo", {
        buffer: validEvidencePng,
        originalName: "evidence.png",
        mimeType: "image/png",
      }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.SOP_STEP_CONFLICT });
  });

  it("advances steps in order, requires frozen evidence, and completes the order", async () => {
    lockedBounty.providerId = providerId;
    lockedBounty.status = BOUNTY_STATUS.CONFIRMED;

    await expect(service.completeSopStep(providerId, bountyId, 2)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.SOP_STEP_CONFLICT,
    });
    await expect(service.completeSopStep(providerId, bountyId, 1)).resolves.toMatchObject({
      orderStatus: BOUNTY_STATUS.IN_PROGRESS,
      currentStepNumber: 2,
    });

    const completedAt = new Date("2026-08-31T00:05:00.000Z");
    const finalSteps = frozenSopSteps.map((step) => ({
      ...step,
      photos: step.stepNumber === 5 ? ["one", "two"] : step.photos,
      completedAt: step.stepNumber < 5 ? completedAt : null,
    }));

    lockedBounty.status = BOUNTY_STATUS.IN_PROGRESS;
    transaction.orderSop.findMany.mockResolvedValueOnce(finalSteps);
    await expect(service.completeSopStep(providerId, bountyId, 5)).resolves.toMatchObject({
      orderStatus: BOUNTY_STATUS.COMPLETED,
      currentStepNumber: null,
      canExecute: false,
    });
    expect(transaction.order.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BOUNTY_STATUS.COMPLETED }),
      }),
    );
  });

  it("rechecks provider qualification before every step mutation", async () => {
    lockedBounty.providerId = providerId;
    lockedBounty.status = BOUNTY_STATUS.CONFIRMED;
    providerEligible = false;

    await expect(service.completeSopStep(providerId, bountyId, 1)).rejects.toMatchObject({
      code: BOUNTY_ERROR_CODE.PROVIDER_NOT_ELIGIBLE,
      status: HttpStatus.CONFLICT,
    });
    expect(transaction.orderSop.updateMany).not.toHaveBeenCalled();
    expect(transaction.order.updateMany).not.toHaveBeenCalled();
  });

  it("compensates a stored evidence object when the locked order can no longer execute", async () => {
    prisma.order.findFirst.mockResolvedValueOnce({
      id: bountyId,
      ownerId: "owner-1",
      providerId,
      status: BOUNTY_STATUS.CONFIRMED,
      sops: frozenSopSteps,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      phone: "13800000000",
      status: "active",
      userType: "provider",
      provider: { idCardVerified: true, trainingPassed: true, certifiedSitter: true },
    });
    lockedBounty.providerId = providerId;
    lockedBounty.status = BOUNTY_STATUS.COMPLETED;

    await expect(
      service.uploadSopEvidence(providerId, bountyId, 1, "photo", {
        buffer: validEvidencePng,
        originalName: "evidence.png",
        mimeType: "image/png",
      }),
    ).rejects.toMatchObject({ code: BOUNTY_ERROR_CODE.SOP_STEP_CONFLICT });
    expect(mediaStorage.delete).toHaveBeenCalledWith("public/sop-media/2026/08/evidence.png");
  });

  it("returns owner-only address data from an owner-scoped query", async () => {
    prisma.order.findMany.mockResolvedValue([privateRow]);

    await expect(service.findMine("owner-1", { page: 1, pageSize: 20 })).resolves.toMatchObject({
      list: [{ id: bountyId, address: "上海市示例地址", remark: "请换水", provider: null }],
      total: 1,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderType: "reward", ownerId: "owner-1", reward: { isNot: null } },
      }),
    );
  });

  it("queries only active open bounties and returns no private fields publicly", async () => {
    prisma.order.findMany.mockResolvedValue([publicRow]);

    const result = await service.findPublic({ page: 1, pageSize: 20 });
    const options = prisma.order.findMany.mock.calls[0][0];

    expect(result.list[0]).toEqual({
      id: bountyId,
      serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
      serviceTime,
      amountCents: 5_000,
      status: BOUNTY_STATUS.OPEN,
      expiresAt: expiresAt.toISOString(),
      owner: { nickname: "小萌", avatar: null },
      pet: { name: "米米", breed: "英短", coverImage: null },
    });
    expect(options.where).toMatchObject({
      orderType: "reward",
      status: BOUNTY_STATUS.OPEN,
      owner: { is: { status: "active" } },
      reward: { is: { expireTime: { gt: now } } },
    });
    expect(options.select).not.toHaveProperty("address");
    expect(options.select).not.toHaveProperty("remark");
    expect(options.select).not.toHaveProperty("ownerId");
    expect(options.select).not.toHaveProperty("petId");
  });

  it("keeps every bounty route closed unless the environment explicitly enables it", () => {
    const disabled = new BountyFeatureGuard({ commercialServicesEnabled: false } as ConfigService);
    const enabled = new BountyFeatureGuard({ commercialServicesEnabled: true } as ConfigService);

    expect(() => disabled.canActivate({} as never)).toThrow(
      expect.objectContaining({
        code: BOUNTY_ERROR_CODE.FEATURE_DISABLED,
        status: HttpStatus.NOT_FOUND,
      }),
    );
    expect(enabled.canActivate({} as never)).toBe(true);
  });
});
