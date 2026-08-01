import { Injectable } from "@nestjs/common";
import { RatingThresholdConfig } from "@petcare/shared-types";
import { ApiException } from "../../../common/http/api-exception";
import { ConfigDomainAdapter, PrismaTransaction } from "../publishing/config-domain.adapter";
import {
  systemConfigNotFound,
  systemConfigPersistenceFailed,
  systemConfigValidationFailed,
} from "../system-settings.errors";

function requireIntegerInRange(value: number, minimum: number, maximum: number, message: string) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw systemConfigValidationFailed(message);
  }
}

/** 评分统计窗口、告警与暂停阈值的强类型配置适配器。 */
@Injectable()
export class RatingThresholdAdapter implements ConfigDomainAdapter<RatingThresholdConfig> {
  /** 评分阈值配置领域键。 */
  readonly domain = "rating_threshold" as const;
  /** 评分阈值配置不包含数组字段。 */
  readonly arrayKeyStrategies = [];

  /** 从指定版本加载完整评分阈值配置。 */
  async load(versionId: string, tx: PrismaTransaction): Promise<RatingThresholdConfig> {
    try {
      const config = await tx.ratingThresholdConfig.findUnique({
        where: { configVersionId: versionId },
      });

      if (!config) {
        throw systemConfigNotFound();
      }

      return {
        evaluationWindow: config.evaluationWindow,
        minimumSampleSize: config.minimumSampleSize,
        warningScore: config.warningScore,
        suspensionScore: config.suspensionScore,
        retrainingRequirement: config.retrainingRequirement,
      };
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw systemConfigPersistenceFailed();
    }
  }

  /** 校验后原子覆盖指定版本的评分阈值配置。 */
  async persist(
    versionId: string,
    config: RatingThresholdConfig,
    tx: PrismaTransaction,
  ): Promise<void> {
    this.validate(config);

    try {
      await tx.ratingThresholdConfig.upsert({
        where: { configVersionId: versionId },
        update: config,
        create: { configVersionId: versionId, ...config },
      });
    } catch {
      throw systemConfigPersistenceFailed();
    }
  }

  /** 完整校验评分窗口、样本、阈值关系和培训说明。 */
  validate(config: RatingThresholdConfig): void {
    requireIntegerInRange(config.evaluationWindow, 5, 100, "评分窗口必须在 5 至 100 天之间");
    requireIntegerInRange(config.minimumSampleSize, 1, 100, "最小样本数必须为正整数");

    if (config.minimumSampleSize > config.evaluationWindow) {
      throw systemConfigValidationFailed("最小样本数不得超过评分窗口");
    }

    requireIntegerInRange(config.warningScore, 100, 500, "警告阈值必须在 100 至 500 之间");
    requireIntegerInRange(config.suspensionScore, 100, 500, "暂停阈值必须在 100 至 500 之间");

    if (config.suspensionScore >= config.warningScore) {
      throw systemConfigValidationFailed("暂停阈值必须严格低于警告阈值");
    }

    if (typeof config.retrainingRequirement !== "string" || !config.retrainingRequirement.trim()) {
      throw systemConfigValidationFailed("再培训要求不能为空");
    }
  }

  /** 返回用于差异比较的完整递归评分配置摘要。 */
  summarize(config: RatingThresholdConfig) {
    return { ...config };
  }
}
