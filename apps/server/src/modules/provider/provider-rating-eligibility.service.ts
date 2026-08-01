import { createHash } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import { RatingThresholdConfig } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import {
  ProviderRatingEligibility,
  ProviderRatingEligibilityStatus as PrismaProviderRatingEligibilityStatus,
  ProviderRetrainingStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SystemSettingsOverviewService } from "../system-settings/system-settings-overview.service";
import { systemConfigNotFound } from "../system-settings/system-settings.errors";

/** 服务者评分资格状态。 */
export type ProviderRatingEligibilityStatus = PrismaProviderRatingEligibilityStatus;

/** 服务者评分资格评估结果。 */
export interface ProviderRatingEligibilityResult {
  /** 服务者档案唯一标识。 */
  providerId: string;
  /** 本次评估使用的发布评分配置版本唯一标识。 */
  ratingConfigVersionId: string;
  /** 本次评估后的资格状态。 */
  status: ProviderRatingEligibilityStatus;
  /** 最近评价的整数百分制平均分；没有评价时为空。 */
  averageScore: number | null;
  /** 本次评估实际使用的评价样本数。 */
  sampleSize: number;
  /** 当前是否禁止服务者继续接单。 */
  isRestricted: boolean;
  /** 恢复接单前必须满足的再培训要求。 */
  retrainingRequirement: string | null;
  /** 当前再培训状态。 */
  retrainingStatus: ProviderRetrainingStatus;
}

/** 判断未知异常是否为 Prisma 唯一约束冲突。 */
function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** 按样本数和严格阈值计算本次评分对应的基础资格状态。 */
function determineScoreStatus(
  config: RatingThresholdConfig,
  sampleSize: number,
  averageScore: number | null,
): ProviderRatingEligibilityStatus {
  if (sampleSize < config.minimumSampleSize) {
    return "insufficient_sample";
  }

  if (averageScore !== null && averageScore < config.suspensionScore) {
    return "suspended";
  }

  if (averageScore !== null && averageScore < config.warningScore) {
    return "warning";
  }

  return "eligible";
}

/** 按当前发布阈值评估服务者评分资格。 */
@Injectable()
export class ProviderRatingEligibilityService {
  /** 创建评分资格评估服务。 */
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SystemSettingsOverviewService,
  ) {}

  /** 读取最近评价并持久化当前资格，不修改任何历史评价。 */
  async evaluate(providerId: string): Promise<ProviderRatingEligibilityResult> {
    const [provider, ratingVersion] = await Promise.all([
      this.prisma.provider.findUnique({
        where: { id: providerId },
        select: { id: true, userId: true },
      }),
      this.settings.getCurrent<RatingThresholdConfig>("rating_threshold"),
    ]);

    if (!provider) {
      throw new ApiException("RESOURCE_NOT_FOUND", "服务者不存在", HttpStatus.NOT_FOUND);
    }

    if (!ratingVersion) {
      throw systemConfigNotFound();
    }

    const reviews = await this.prisma.review.findMany({
      where: { order: { providerId: provider.userId } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ratingVersion.config.evaluationWindow,
      select: { id: true, overallRating: true },
    });
    const sampleSize = reviews.length;
    const averageScore =
      sampleSize === 0
        ? null
        : Math.round(
            reviews.reduce((total, review) => total + review.overallRating * 100, 0) / sampleSize,
          );
    const scoreStatus = determineScoreStatus(ratingVersion.config, sampleSize, averageScore);
    const evaluationKey = createHash("sha256")
      .update(
        `${providerId}:${ratingVersion.id}:${reviews
          .map((review) => `${review.id}:${review.overallRating}`)
          .join(",")}`,
      )
      .digest("hex");

    try {
      const eligibility = await this.prisma.$transaction(async (tx) => {
        const current = await tx.providerRatingEligibility.findUnique({ where: { providerId } });

        if (
          current?.evaluationKey === evaluationKey &&
          !(current.status === "suspended" && current.retrainingStatus === "completed")
        ) {
          return current;
        }

        const recoveryBlocked =
          current?.status === "suspended" &&
          current.retrainingStatus !== "completed" &&
          scoreStatus !== "suspended";
        const status: ProviderRatingEligibilityStatus = recoveryBlocked ? "suspended" : scoreStatus;
        const isSuspended = status === "suspended";
        let retrainingStatus: ProviderRetrainingStatus = "not_required";

        if (scoreStatus === "suspended") {
          retrainingStatus = "required";
        } else if (recoveryBlocked) {
          retrainingStatus = current.retrainingStatus;
        }

        let actionDeduplicationKey: string | null = null;

        if (recoveryBlocked) {
          actionDeduplicationKey = current.actionDeduplicationKey;
        } else if (scoreStatus === "warning" || scoreStatus === "suspended") {
          const action = scoreStatus === "suspended" ? "suspension" : "warning";

          actionDeduplicationKey =
            current?.status === scoreStatus && current.actionDeduplicationKey
              ? current.actionDeduplicationKey
              : `provider-rating-${action}:${providerId}:${evaluationKey}`;
        }

        const data = {
          ratingConfigVersionId: ratingVersion.id,
          evaluationKey,
          status,
          averageScore,
          sampleSize,
          retrainingRequirement: isSuspended
            ? (current?.retrainingRequirement ?? ratingVersion.config.retrainingRequirement)
            : null,
          retrainingStatus,
          actionDeduplicationKey,
          suspendedAt: isSuspended ? (current?.suspendedAt ?? new Date()) : null,
          evaluatedAt: new Date(),
        };

        const eligibility = await (current
          ? tx.providerRatingEligibility.update({ where: { providerId }, data })
          : tx.providerRatingEligibility.create({ data: { providerId, ...data } }));

        if (!recoveryBlocked && (scoreStatus === "warning" || scoreStatus === "suspended")) {
          const isSuspension = scoreStatus === "suspended";
          const action = isSuspension ? "suspension" : "warning";

          if (!actionDeduplicationKey) {
            throw new Error("Provider rating action key was not created");
          }

          const deduplicationKey = actionDeduplicationKey;

          await Promise.all([
            tx.adminTodo.upsert({
              where: { deduplicationKey },
              update: {},
              create: {
                providerId,
                type: `provider_rating_${action}`,
                title: isSuspension ? "服务者评分触发暂停接单" : "服务者评分低于警告阈值",
                content: `服务者最近 ${sampleSize} 条评价平均分为 ${averageScore}，请及时跟进。`,
                deduplicationKey,
              },
            }),
            tx.notification.upsert({
              where: { deduplicationKey },
              update: {},
              create: {
                userId: provider.userId,
                type: "system",
                title: isSuspension ? "接单资格已暂停" : "服务评分提醒",
                content: isSuspension
                  ? `您的近期服务评分低于平台暂停阈值，完成以下要求后方可恢复接单：${ratingVersion.config.retrainingRequirement}`
                  : "您的近期服务评分低于平台警告阈值，请及时改善服务质量。",
                referenceId: providerId,
                deduplicationKey,
              },
            }),
          ]);
        }

        return eligibility;
      });

      return this.toResult(eligibility);
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      if (isUniqueConstraintError(error)) {
        const concurrent = await this.prisma.providerRatingEligibility.findUnique({
          where: { providerId },
        });

        if (concurrent?.evaluationKey === evaluationKey) {
          return this.toResult(concurrent);
        }
      }

      throw new ApiException(
        "PROVIDER_RATING_EVALUATION_FAILED",
        "服务者评分资格评估失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** 在服务者接单入口调用，拒绝当前处于暂停状态的服务者。 */
  async assertCanAcceptOrders(providerId: string): Promise<void> {
    const eligibility = await this.prisma.providerRatingEligibility.findUnique({
      where: { providerId },
      select: { status: true },
    });

    if (eligibility?.status === "suspended") {
      throw new ApiException(
        "PROVIDER_ORDER_ACCEPTANCE_SUSPENDED",
        "服务者接单资格已暂停",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private toResult(
    eligibility: Pick<
      ProviderRatingEligibility,
      | "providerId"
      | "ratingConfigVersionId"
      | "status"
      | "averageScore"
      | "sampleSize"
      | "retrainingRequirement"
      | "retrainingStatus"
    >,
  ): ProviderRatingEligibilityResult {
    return {
      providerId: eligibility.providerId,
      ratingConfigVersionId: eligibility.ratingConfigVersionId,
      status: eligibility.status,
      averageScore: eligibility.averageScore,
      sampleSize: eligibility.sampleSize,
      isRestricted: eligibility.status === "suspended",
      retrainingRequirement: eligibility.retrainingRequirement,
      retrainingStatus: eligibility.retrainingStatus,
    };
  }
}
