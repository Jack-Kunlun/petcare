import { createHash } from "node:crypto";
import {
  Prisma,
  ProviderRatingEligibilityStatus,
  ProviderRetrainingStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SystemSettingsOverviewService } from "../system-settings/system-settings-overview.service";
import { ProviderRatingEligibilityService } from "./provider-rating-eligibility.service";

describe("ProviderRatingEligibilityService", () => {
  const prisma = {
    $transaction: jest.fn(),
    provider: {
      findUnique: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    providerRatingEligibility: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminTodo: {
      upsert: jest.fn(),
    },
    notification: {
      upsert: jest.fn(),
    },
  };
  const settings = {
    getCurrent: jest.fn(),
  };
  const service = new ProviderRatingEligibilityService(
    prisma as unknown as PrismaService,
    settings as unknown as SystemSettingsOverviewService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
    prisma.provider.findUnique.mockResolvedValue({
      id: "provider-1",
      userId: "provider-user-1",
    });
    settings.getCurrent.mockResolvedValue({
      id: "rating-v3",
      config: {
        evaluationWindow: 5,
        minimumSampleSize: 3,
        warningScore: 400,
        suspensionScore: 300,
        retrainingRequirement: "完成平台重新培训并通过管理员审核",
      },
    });
    prisma.providerRatingEligibility.findUnique.mockResolvedValue(null);
    prisma.providerRatingEligibility.create.mockImplementation(({ data }) => ({
      id: "eligibility-1",
      ...data,
    }));
  });

  it("最近评价少于最小样本时仅展示分数而不限制接单", async () => {
    prisma.review.findMany.mockResolvedValue([
      { id: "review-2", overallRating: 4 },
      { id: "review-1", overallRating: 5 },
    ]);

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      providerId: "provider-1",
      ratingConfigVersionId: "rating-v3",
      status: "insufficient_sample",
      averageScore: 450,
      sampleSize: 2,
      isRestricted: false,
      retrainingRequirement: null,
      retrainingStatus: "not_required",
    });

    expect(prisma.review.findMany).toHaveBeenCalledWith({
      where: { order: { providerId: "provider-user-1" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: { id: true, overallRating: true },
    });
    expect(prisma.adminTodo.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it("平均分严格低于警告阈值时创建管理员待办和服务者通知", async () => {
    prisma.review.findMany.mockResolvedValue([
      { id: "review-5", overallRating: 4 },
      { id: "review-4", overallRating: 4 },
      { id: "review-3", overallRating: 4 },
      { id: "review-2", overallRating: 4 },
      { id: "review-1", overallRating: 3 },
    ]);

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      status: "warning",
      averageScore: 380,
      sampleSize: 5,
      isRestricted: false,
      retrainingRequirement: null,
      retrainingStatus: "not_required",
    });

    expect(prisma.adminTodo.upsert).toHaveBeenCalledWith({
      where: {
        deduplicationKey: expect.stringMatching(/^provider-rating-warning:provider-1:/),
      },
      update: {},
      create: expect.objectContaining({
        providerId: "provider-1",
        type: "provider_rating_warning",
        deduplicationKey: expect.stringMatching(/^provider-rating-warning:provider-1:/),
      }),
    });
    expect(prisma.notification.upsert).toHaveBeenCalledWith({
      where: {
        deduplicationKey: expect.stringMatching(/^provider-rating-warning:provider-1:/),
      },
      update: {},
      create: expect.objectContaining({
        userId: "provider-user-1",
        type: "system",
        referenceId: "provider-1",
        deduplicationKey: expect.stringMatching(/^provider-rating-warning:provider-1:/),
      }),
    });
  });

  it("平均分严格低于暂停阈值时暂停接单并保存再培训恢复状态", async () => {
    prisma.review.findMany.mockResolvedValue([
      { id: "review-5", overallRating: 3 },
      { id: "review-4", overallRating: 3 },
      { id: "review-3", overallRating: 3 },
      { id: "review-2", overallRating: 3 },
      { id: "review-1", overallRating: 2 },
    ]);

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      status: "suspended",
      averageScore: 280,
      sampleSize: 5,
      isRestricted: true,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
      retrainingStatus: "required",
    });

    expect(prisma.providerRatingEligibility.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerId: "provider-1",
        status: "suspended",
        retrainingRequirement: "完成平台重新培训并通过管理员审核",
        retrainingStatus: "required",
        suspendedAt: expect.any(Date),
      }),
    });
    expect(prisma.adminTodo.upsert).toHaveBeenCalledWith({
      where: {
        deduplicationKey: expect.stringMatching(/^provider-rating-suspension:provider-1:/),
      },
      update: {},
      create: expect.objectContaining({
        type: "provider_rating_suspension",
        deduplicationKey: expect.stringMatching(/^provider-rating-suspension:provider-1:/),
      }),
    });
    expect(prisma.notification.upsert).toHaveBeenCalledWith({
      where: {
        deduplicationKey: expect.stringMatching(/^provider-rating-suspension:provider-1:/),
      },
      update: {},
      create: expect.objectContaining({
        deduplicationKey: expect.stringMatching(/^provider-rating-suspension:provider-1:/),
      }),
    });
  });

  it.each([
    ["警告", [4, 4, 4, 4, 4], 400, "eligible"],
    ["暂停", [3, 3, 3, 3, 3], 300, "warning"],
  ])("平均分等于%s阈值时不进入更严重状态", async (_label, scores, averageScore, status) => {
    prisma.review.findMany.mockResolvedValue(
      scores.map((overallRating, index) => ({
        id: `review-${scores.length - index}`,
        overallRating,
      })),
    );

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      averageScore,
      status,
      isRestricted: false,
    });
  });

  it("使用未舍入平均分比较严格警告阈值", async () => {
    settings.getCurrent.mockResolvedValue({
      id: "rating-v-fractional",
      config: {
        evaluationWindow: 5,
        minimumSampleSize: 3,
        warningScore: 367,
        suspensionScore: 300,
        retrainingRequirement: "完成平台重新培训并通过管理员审核",
      },
    });
    prisma.review.findMany.mockResolvedValue([
      { id: "review-3", overallRating: 4 },
      { id: "review-2", overallRating: 4 },
      { id: "review-1", overallRating: 3 },
    ]);

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      averageScore: 367,
      status: "warning",
      isRestricted: false,
    });
  });

  it("相同配置和评价重复评估时不重复待办通知或暂停动作", async () => {
    prisma.review.findMany.mockResolvedValue([
      { id: "review-5", overallRating: 3 },
      { id: "review-4", overallRating: 3 },
      { id: "review-3", overallRating: 3 },
      { id: "review-2", overallRating: 3 },
      { id: "review-1", overallRating: 2 },
    ]);
    let storedEligibility: Record<string, unknown> | null = null;

    prisma.providerRatingEligibility.findUnique.mockImplementation(async () => storedEligibility);
    prisma.providerRatingEligibility.create.mockImplementation(async ({ data }) => {
      storedEligibility = { id: "eligibility-1", ...data };

      return storedEligibility;
    });
    prisma.providerRatingEligibility.update.mockImplementation(async ({ data }) => {
      storedEligibility = { ...storedEligibility, ...data };

      return storedEligibility;
    });

    const first = await service.evaluate("provider-1");
    const firstSuspendedAt = storedEligibility?.suspendedAt;
    const second = await service.evaluate("provider-1");

    expect(second).toEqual(first);
    expect(storedEligibility?.suspendedAt).toBe(firstSuspendedAt);
    expect(prisma.providerRatingEligibility.create).toHaveBeenCalledTimes(1);
    expect(prisma.providerRatingEligibility.update).not.toHaveBeenCalled();
    expect(prisma.adminTodo.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
  });

  it("资格状态或副作用写入失败时不泄漏底层数据库异常", async () => {
    prisma.review.findMany.mockResolvedValue([
      { id: "review-5", overallRating: 4 },
      { id: "review-4", overallRating: 4 },
      { id: "review-3", overallRating: 4 },
      { id: "review-2", overallRating: 4 },
      { id: "review-1", overallRating: 3 },
    ]);
    prisma.providerRatingEligibility.create.mockRejectedValue(
      new Error("P2002: unique constraint failed on provider_id"),
    );

    try {
      await service.evaluate("provider-1");
      throw new Error("Expected evaluate to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROVIDER_RATING_EVALUATION_FAILED",
        clientMessage: "服务者评分资格评估失败",
      });
      expect((error as Error).message).not.toContain("P2002");
    }
  });

  it("暂停后的评分回升不绕过仍未完成的再培训要求", async () => {
    const suspendedAt = new Date("2026-08-01T00:00:00.000Z");
    const current = {
      id: "eligibility-1",
      providerId: "provider-1",
      ratingConfigVersionId: "rating-v2",
      evaluationKey: "previous-evaluation",
      status: "suspended",
      averageScore: 280,
      sampleSize: 5,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
      retrainingStatus: "required",
      suspendedAt,
      evaluatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };

    prisma.review.findMany.mockResolvedValue([
      { id: "review-10", overallRating: 5 },
      { id: "review-9", overallRating: 5 },
      { id: "review-8", overallRating: 5 },
      { id: "review-7", overallRating: 5 },
      { id: "review-6", overallRating: 5 },
    ]);
    prisma.providerRatingEligibility.findUnique.mockResolvedValue(current);
    prisma.providerRatingEligibility.update.mockImplementation(async ({ data }) => ({
      ...current,
      ...data,
    }));

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      status: "suspended",
      averageScore: 500,
      isRestricted: true,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
      retrainingStatus: "required",
    });
    expect(prisma.providerRatingEligibility.update).toHaveBeenCalledWith({
      where: { providerId: "provider-1" },
      data: expect.objectContaining({
        status: "suspended",
        suspendedAt,
        retrainingStatus: "required",
      }),
    });
    expect(prisma.adminTodo.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.upsert).not.toHaveBeenCalled();
  });

  it("发布评分新版本后仅在下一次评估生效且不修改历史评价", async () => {
    const reviews = [
      { id: "review-5", overallRating: 4 },
      { id: "review-4", overallRating: 4 },
      { id: "review-3", overallRating: 4 },
      { id: "review-2", overallRating: 4 },
      { id: "review-1", overallRating: 3 },
    ];
    let storedEligibility: Record<string, unknown> | null = null;

    prisma.review.findMany.mockResolvedValue(reviews);
    settings.getCurrent
      .mockResolvedValueOnce({
        id: "rating-v3",
        config: {
          evaluationWindow: 5,
          minimumSampleSize: 3,
          warningScore: 400,
          suspensionScore: 300,
          retrainingRequirement: "完成旧版培训",
        },
      })
      .mockResolvedValueOnce({
        id: "rating-v4",
        config: {
          evaluationWindow: 5,
          minimumSampleSize: 3,
          warningScore: 450,
          suspensionScore: 390,
          retrainingRequirement: "完成新版培训",
        },
      });
    prisma.providerRatingEligibility.findUnique.mockImplementation(async () => storedEligibility);
    prisma.providerRatingEligibility.create.mockImplementation(async ({ data }) => {
      storedEligibility = { id: "eligibility-1", ...data };

      return storedEligibility;
    });
    prisma.providerRatingEligibility.update.mockImplementation(async ({ data }) => {
      storedEligibility = { ...storedEligibility, ...data };

      return storedEligibility;
    });

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      ratingConfigVersionId: "rating-v3",
      status: "warning",
    });
    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      ratingConfigVersionId: "rating-v4",
      status: "suspended",
      retrainingRequirement: "完成新版培训",
    });

    expect(prisma.providerRatingEligibility.update).toHaveBeenCalledTimes(1);
    expect(prisma.review.updateMany).not.toHaveBeenCalled();
  });

  it("并发首次评估命中唯一约束时返回已提交的相同结果", async () => {
    prisma.review.findMany.mockResolvedValue([
      { id: "review-5", overallRating: 3 },
      { id: "review-4", overallRating: 3 },
      { id: "review-3", overallRating: 3 },
      { id: "review-2", overallRating: 3 },
      { id: "review-1", overallRating: 2 },
    ]);
    prisma.$transaction.mockRejectedValueOnce({ code: "P2002" });
    prisma.providerRatingEligibility.findUnique.mockResolvedValue({
      id: "eligibility-1",
      providerId: "provider-1",
      ratingConfigVersionId: "rating-v3",
      evaluationKey: createHash("sha256")
        .update("provider-1:rating-v3:review-5:3,review-4:3,review-3:3,review-2:3,review-1:2")
        .digest("hex"),
      status: "suspended",
      averageScore: 280,
      sampleSize: 5,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
      retrainingStatus: "required",
      suspendedAt: new Date(),
      evaluatedAt: new Date(),
    });

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      status: "suspended",
      averageScore: 280,
      isRestricted: true,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("服务者恢复后再次跌入警告区间时创建新一轮待办和通知", async () => {
    const warningA = [4, 4, 4, 4, 3].map((overallRating, index) => ({
      id: `warning-a-${index}`,
      overallRating,
    }));
    const eligible = [5, 5, 5, 5, 5].map((overallRating, index) => ({
      id: `eligible-${index}`,
      overallRating,
    }));
    const warningB = [4, 4, 4, 3, 4].map((overallRating, index) => ({
      id: `warning-b-${index}`,
      overallRating,
    }));
    let storedEligibility: Record<string, unknown> | null = null;

    prisma.review.findMany
      .mockResolvedValueOnce(warningA)
      .mockResolvedValueOnce(eligible)
      .mockResolvedValueOnce(warningB);
    prisma.providerRatingEligibility.findUnique.mockImplementation(async () => storedEligibility);
    prisma.providerRatingEligibility.create.mockImplementation(async ({ data }) => {
      storedEligibility = { id: "eligibility-1", ...data };

      return storedEligibility;
    });
    prisma.providerRatingEligibility.update.mockImplementation(async ({ data }) => {
      storedEligibility = { ...storedEligibility, ...data };

      return storedEligibility;
    });

    await service.evaluate("provider-1");
    await service.evaluate("provider-1");
    await service.evaluate("provider-1");

    const todoKeys = prisma.adminTodo.upsert.mock.calls.map(
      ([{ where }]) => where.deduplicationKey,
    );
    const notificationKeys = prisma.notification.upsert.mock.calls.map(
      ([{ where }]) => where.deduplicationKey,
    );

    expect(todoKeys).toHaveLength(2);
    expect(new Set(todoKeys).size).toBe(2);
    expect(new Set(notificationKeys).size).toBe(2);
  });

  it("再培训完成后即使评价摘要未变也会重新评估并恢复资格", async () => {
    const reviews = [5, 5, 5, 5, 5].map((overallRating, index) => ({
      id: `review-${5 - index}`,
      overallRating,
    }));
    const evaluationKey = createHash("sha256")
      .update("provider-1:rating-v3:review-5:5,review-4:5,review-3:5,review-2:5,review-1:5")
      .digest("hex");
    const current = {
      id: "eligibility-1",
      providerId: "provider-1",
      ratingConfigVersionId: "rating-v3",
      evaluationKey,
      status: "suspended",
      averageScore: 500,
      sampleSize: 5,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
      retrainingStatus: "completed",
      suspendedAt: new Date("2026-08-01T00:00:00.000Z"),
      evaluatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };

    prisma.review.findMany.mockResolvedValue(reviews);
    prisma.providerRatingEligibility.findUnique.mockResolvedValue(current);
    prisma.providerRatingEligibility.update.mockImplementation(async ({ data }) => ({
      ...current,
      ...data,
    }));

    await expect(service.evaluate("provider-1")).resolves.toMatchObject({
      status: "eligible",
      isRestricted: false,
      retrainingRequirement: null,
      retrainingStatus: "not_required",
    });
    expect(prisma.providerRatingEligibility.update).toHaveBeenCalledTimes(1);
  });

  it("暂停资格会被接单门禁拒绝", async () => {
    prisma.providerRatingEligibility.findUnique.mockResolvedValue({ status: "suspended" });

    await expect(service.assertCanAcceptOrders("provider-1")).rejects.toMatchObject({
      code: "PROVIDER_ORDER_ACCEPTANCE_SUSPENDED",
      clientMessage: "服务者接单资格已暂停",
    });
  });

  it("Prisma 枚举仅允许已定义的资格和再培训状态", () => {
    expect(Object.values(ProviderRatingEligibilityStatus)).toEqual([
      "insufficient_sample",
      "eligible",
      "warning",
      "suspended",
    ]);
    expect(Object.values(ProviderRetrainingStatus)).toEqual([
      "not_required",
      "required",
      "completed",
    ]);
    expect(Object.values(ProviderRatingEligibilityStatus)).not.toContain("invalid");
    expect(Object.values(ProviderRetrainingStatus)).not.toContain("invalid");
  });

  it.each([
    ["服务者", () => prisma.provider.findUnique.mockRejectedValue(new Error("P2024 provider SQL"))],
    ["发布配置", () => settings.getCurrent.mockRejectedValue(new Error("P2024 config SQL"))],
    ["评价窗口", () => prisma.review.findMany.mockRejectedValue(new Error("P2024 review SQL"))],
    [
      "当前资格",
      () =>
        prisma.providerRatingEligibility.findUnique.mockRejectedValue(
          new Error("P2024 eligibility SQL"),
        ),
    ],
  ])("%s查询失败时返回稳定评估错误", async (_label, arrange) => {
    prisma.review.findMany.mockResolvedValue([]);
    arrange();

    try {
      await service.evaluate("provider-1");
      throw new Error("Expected evaluate to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROVIDER_RATING_EVALUATION_FAILED",
        clientMessage: "服务者评分资格评估失败",
      });
      expect((error as Error).message).not.toMatch(/P2024|SQL/u);
    }
  });

  it.each([null, "insufficient_sample", "eligible", "warning"])(
    "资格状态为 %s 时允许进入接单流程",
    async (status) => {
      prisma.providerRatingEligibility.findUnique.mockResolvedValue(status ? { status } : null);

      await expect(service.assertCanAcceptOrders("provider-1")).resolves.toBeUndefined();
    },
  );

  it("接单资格查询失败时返回稳定门禁错误", async () => {
    prisma.providerRatingEligibility.findUnique.mockRejectedValue(
      new Error("P2024 eligibility gate SQL"),
    );

    try {
      await service.assertCanAcceptOrders("provider-1");
      throw new Error("Expected assertCanAcceptOrders to reject");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROVIDER_ELIGIBILITY_CHECK_FAILED",
        clientMessage: "服务者接单资格检查失败",
      });
      expect((error as Error).message).not.toMatch(/P2024|SQL/u);
    }
  });

  it("可串行化并发评估重试后旧摘要不会覆盖新的暂停状态", async () => {
    const warningReviews = [4, 4, 4, 4, 3].map((overallRating, index) => ({
      id: `warning-${index}`,
      overallRating,
    }));
    const suspendedReviews = [3, 3, 3, 3, 2].map((overallRating, index) => ({
      id: `suspended-${index}`,
      overallRating,
    }));
    let storedEligibility: Record<string, unknown> | null = null;
    const committedTodoTypes: string[] = [];
    const committedNotificationTitles: string[] = [];
    const transactionOptions: unknown[] = [];
    let transactionNumber = 0;
    let markFirstAttemptReady: () => void;
    let markSecondCommitted: () => void;
    const firstAttemptReady = new Promise<void>((resolve) => {
      markFirstAttemptReady = resolve;
    });
    const secondCommitted = new Promise<void>((resolve) => {
      markSecondCommitted = resolve;
    });

    prisma.review.findMany
      .mockResolvedValueOnce(warningReviews)
      .mockResolvedValueOnce(suspendedReviews)
      .mockResolvedValue(suspendedReviews);
    prisma.$transaction.mockImplementation(async (work, options) => {
      transactionNumber += 1;
      const currentTransaction = transactionNumber;
      const reviews = currentTransaction === 1 ? warningReviews : suspendedReviews;
      let localEligibility = storedEligibility;
      const todoTypes: string[] = [];
      const notificationTitles: string[] = [];
      const tx = {
        provider: {
          findUnique: jest.fn().mockResolvedValue({
            id: "provider-1",
            userId: "provider-user-1",
          }),
        },
        review: {
          findMany: jest.fn().mockResolvedValue(reviews),
        },
        providerRatingEligibility: {
          findUnique: jest.fn().mockImplementation(async () => localEligibility),
          create: jest.fn().mockImplementation(async ({ data }) => {
            localEligibility = { id: "eligibility-1", ...data };

            return localEligibility;
          }),
          update: jest.fn().mockImplementation(async ({ data }) => {
            localEligibility = { ...localEligibility, ...data };

            return localEligibility;
          }),
        },
        adminTodo: {
          upsert: jest.fn().mockImplementation(async ({ create }) => {
            todoTypes.push(create.type);

            return create;
          }),
        },
        notification: {
          upsert: jest.fn().mockImplementation(async ({ create }) => {
            notificationTitles.push(create.title);

            return create;
          }),
        },
      };

      transactionOptions.push(options);
      const result = await work(tx);

      if (currentTransaction === 1) {
        markFirstAttemptReady();
        await secondCommitted;
        throw { code: "P2034" };
      }

      storedEligibility = localEligibility;
      committedTodoTypes.push(...todoTypes);
      committedNotificationTitles.push(...notificationTitles);

      if (currentTransaction === 2) {
        markSecondCommitted();
      }

      return result;
    });

    const oldEvaluation = service.evaluate("provider-1");

    await firstAttemptReady;

    const newEvaluation = service.evaluate("provider-1");
    const [oldResult, newResult] = await Promise.all([oldEvaluation, newEvaluation]);

    expect(oldResult.status).toBe("suspended");
    expect(newResult.status).toBe("suspended");
    expect(storedEligibility).toMatchObject({ status: "suspended", averageScore: 280 });
    expect(committedTodoTypes).toEqual(["provider_rating_suspension"]);
    expect(committedNotificationTitles).toEqual(["接单资格已暂停"]);
    expect(transactionOptions).toEqual([
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ]);
  });

  it("可串行化冲突最多重试三次后返回稳定错误", async () => {
    prisma.$transaction.mockRejectedValue({ code: "P2034" });

    await expect(service.evaluate("provider-1")).rejects.toMatchObject({
      code: "PROVIDER_RATING_EVALUATION_FAILED",
      clientMessage: "服务者评分资格评估失败",
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});
