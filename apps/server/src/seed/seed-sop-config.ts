import { BOUNTY_SERVICE_TYPE } from "@petcare/shared-types";
import { PrismaClient } from "../generated/prisma/client";

const serviceStep = {
  [BOUNTY_SERVICE_TYPE.FEEDING]: {
    stepName: "执行喂养",
    instruction: "按主人备注完成喂食、换水并记录过程。",
    expectedDurationMinutes: 15,
  },
  [BOUNTY_SERVICE_TYPE.WALKING]: {
    stepName: "执行遛狗",
    instruction: "使用牵引装备完成约定路线，并持续观察宠物状态。",
    expectedDurationMinutes: 30,
  },
  [BOUNTY_SERVICE_TYPE.PLAYING]: {
    stepName: "执行陪玩",
    instruction: "使用安全玩具完成互动，并持续观察宠物状态。",
    expectedDurationMinutes: 20,
  },
} as const;

const baselineSteps = Object.values(BOUNTY_SERVICE_TYPE).flatMap((serviceType) => [
  {
    serviceType,
    stepNumber: 1,
    stepName: "到达与消毒",
    instruction: "到达服务地址后完成手部和随身用品消毒，并拍照记录。",
    expectedDurationMinutes: 2,
    minimumPhotoCount: 1,
    videoRequired: false,
  },
  {
    serviceType,
    stepNumber: 2,
    stepName: "宠物状态打卡",
    instruction: "检查宠物精神、饮水和环境状态，至少提交两张照片。",
    expectedDurationMinutes: 3,
    minimumPhotoCount: 2,
    videoRequired: false,
  },
  {
    serviceType,
    stepNumber: 3,
    ...serviceStep[serviceType],
    minimumPhotoCount: 1,
    videoRequired: true,
  },
  {
    serviceType,
    stepNumber: 4,
    stepName: "清理现场",
    instruction: "清理服务产生的垃圾并恢复现场整洁，拍照记录结果。",
    expectedDurationMinutes: 3,
    minimumPhotoCount: 1,
    videoRequired: false,
  },
  {
    serviceType,
    stepNumber: 5,
    stepName: "离开确认",
    instruction: "确认宠物、门窗和门锁状态，提交宠物与离开现场照片。",
    expectedDurationMinutes: 2,
    minimumPhotoCount: 2,
    videoRequired: false,
  },
]);

/** Creates one inert baseline SOP version only when no published SOP pointer exists. */
export async function seedSopConfiguration(
  prisma: PrismaClient,
  administratorId: string,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    if (
      await transaction.systemConfigPointer.findUnique({
        where: { configKey: "sop" },
        select: { configKey: true },
      })
    ) {
      return;
    }

    const currentPublished = await transaction.systemConfigVersion.findFirst({
      where: { configKey: "sop", status: "published" },
      orderBy: { businessVersion: "desc" },
      select: { id: true },
    });

    if (currentPublished) {
      await transaction.systemConfigPointer.create({
        data: { configKey: "sop", publishedVersionId: currentPublished.id },
      });

      return;
    }

    const latest = await transaction.systemConfigVersion.findFirst({
      where: { configKey: "sop" },
      orderBy: { businessVersion: "desc" },
      select: { businessVersion: true },
    });
    const version = await transaction.systemConfigVersion.create({
      data: {
        configKey: "sop",
        status: "published",
        businessVersion: (latest?.businessVersion ?? 0) + 1,
        revision: 1,
        createdById: administratorId,
        updatedById: administratorId,
        publishedById: administratorId,
        publishedAt: new Date(),
        changeSummary: "初始化基础 C2C 履约 SOP",
        sopSteps: { create: baselineSteps },
        sopViolationRules: {
          create: [
            {
              severity: "moderate",
              description: "发现宠物或环境异常时立即停止服务、联系主人，并保留现场证据。",
              serviceFeeDeductionBps: null,
              ratingDeductionScore: 0,
              suspensionDays: 0,
              retrainingRequired: false,
              sortOrder: 1,
            },
          ],
        },
      },
      select: { id: true },
    });

    await transaction.systemConfigPointer.create({
      data: { configKey: "sop", publishedVersionId: version.id },
    });
  });
}
