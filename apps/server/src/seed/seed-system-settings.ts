import { Prisma, PrismaClient } from "../generated/prisma/client";

const DEFAULT_CHANGE_SUMMARY = "初始化系统默认配置";

const SOP_STEPS = [
  {
    stepNumber: 1,
    stepName: "进门消毒",
    instruction: "在门口拍照后完成手部与用品消毒，并拍照确认。",
    expectedDurationMinutes: 2,
    minimumPhotoCount: 2,
    videoRequired: false,
  },
  {
    stepNumber: 2,
    stepName: "拍照打卡",
    instruction: "拍摄宠物当前状态并记录精神、饮食与环境情况。",
    expectedDurationMinutes: 3,
    minimumPhotoCount: 1,
    videoRequired: false,
  },
  {
    stepNumber: 3,
    stepName: "执行服务",
    instruction: "按服务类型完成约定服务，记录关键过程并上传视频。",
    expectedDurationMinutes: 30,
    minimumPhotoCount: 1,
    videoRequired: true,
  },
  {
    stepNumber: 4,
    stepName: "清理现场",
    instruction: "清理服务产生的垃圾并拍摄整理后的环境。",
    expectedDurationMinutes: 3,
    minimumPhotoCount: 1,
    videoRequired: false,
  },
  {
    stepNumber: 5,
    stepName: "离开拍照",
    instruction: "拍摄宠物状态与门锁情况，确认安全后填写服务小结。",
    expectedDurationMinutes: 2,
    minimumPhotoCount: 2,
    videoRequired: false,
  },
] as const;

const SERVICE_TYPES = ["feeding", "walking", "playing"] as const;

const VIOLATION_RULES = [
  {
    severity: "minor",
    description: "漏拍一至两张要求照片时，扣减服务费百分之十。",
    serviceFeeDeductionBps: 1000,
    ratingDeductionScore: 0,
    suspensionDays: 0,
    retrainingRequired: false,
    sortOrder: 1,
  },
  {
    severity: "moderate",
    description: "漏拍三张以上或跳过步骤时，扣减服务费百分之三十并扣减零点五星。",
    serviceFeeDeductionBps: 3000,
    ratingDeductionScore: 50,
    suspensionDays: 0,
    retrainingRequired: false,
    sortOrder: 2,
  },
  {
    severity: "severe",
    description: "完全未按 SOP 执行时，暂停接单七天、扣减一星并要求重新培训。",
    serviceFeeDeductionBps: null,
    ratingDeductionScore: 100,
    suspensionDays: 7,
    retrainingRequired: true,
    sortOrder: 3,
  },
] as const;

async function createPublishedVersion(
  tx: Prisma.TransactionClient,
  configKey: string,
  operatorId: string,
) {
  const idempotencyKey = `seed:${configKey}:published:v1`;
  const version = await tx.systemConfigVersion.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      configKey,
      status: "published",
      businessVersion: 1,
      revision: 1,
      createdById: operatorId,
      updatedById: operatorId,
      publishedById: operatorId,
      publishedAt: new Date(),
      idempotencyKey,
      changeSummary: DEFAULT_CHANGE_SUMMARY,
    },
  });

  await tx.systemConfigPointer.upsert({
    where: { configKey },
    update: { publishedVersionId: version.id },
    create: { configKey, publishedVersionId: version.id },
  });

  await tx.systemConfigAuditEvent.upsert({
    where: {
      configKey_idempotencyKey: {
        configKey,
        idempotencyKey,
      },
    },
    update: {},
    create: {
      configKey,
      configVersionId: version.id,
      operatorId,
      action: "publish",
      idempotencyKey,
      changeSummary: DEFAULT_CHANGE_SUMMARY,
    },
  });

  return version;
}

/**
 * 幂等创建系统设置的默认已发布版本、当前版本指针和审计事件。
 *
 * @param prisma Prisma 数据库客户端。
 * @param operatorId 执行初始化的管理员唯一标识。
 */
export async function seedSystemSettings(prisma: PrismaClient, operatorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const sopVersion = await createPublishedVersion(tx, "sop", operatorId);

    await Promise.all(
      SERVICE_TYPES.flatMap((serviceType) =>
        SOP_STEPS.map((step) =>
          tx.sopConfigStep.upsert({
            where: {
              configVersionId_serviceType_stepNumber: {
                configVersionId: sopVersion.id,
                serviceType,
                stepNumber: step.stepNumber,
              },
            },
            update: {},
            create: {
              configVersionId: sopVersion.id,
              serviceType,
              ...step,
            },
          }),
        ),
      ),
    );

    await Promise.all(
      VIOLATION_RULES.map((rule) =>
        tx.sopViolationRule.upsert({
          where: {
            configVersionId_severity: {
              configVersionId: sopVersion.id,
              severity: rule.severity,
            },
          },
          update: {},
          create: {
            configVersionId: sopVersion.id,
            ...rule,
          },
        }),
      ),
    );

    const ratingVersion = await createPublishedVersion(tx, "rating_threshold", operatorId);

    await tx.ratingThresholdConfig.upsert({
      where: { configVersionId: ratingVersion.id },
      update: {},
      create: {
        configVersionId: ratingVersion.id,
        evaluationWindow: 30,
        minimumSampleSize: 10,
        warningScore: 350,
        suspensionScore: 300,
        retrainingRequirement: "完成平台服务规范再培训并通过考核后恢复接单。",
      },
    });

    const feeVersion = await createPublishedVersion(tx, "fee", operatorId);

    await tx.feeConfig.upsert({
      where: { configVersionId: feeVersion.id },
      update: {},
      create: {
        configVersionId: feeVersion.id,
        platformCommissionBps: 1000,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      },
    });
  });
}
