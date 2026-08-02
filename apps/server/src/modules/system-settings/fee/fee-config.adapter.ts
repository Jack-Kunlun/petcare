import { Injectable } from "@nestjs/common";
import { FeeConfig } from "@petcare/shared-types";
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

/** 平台抽成、服务费和提现手续费的强类型配置适配器。 */
@Injectable()
export class FeeConfigAdapter implements ConfigDomainAdapter<FeeConfig> {
  /** 费用配置领域键。 */
  readonly domain = "fee" as const;
  /** 费用配置不包含数组字段。 */
  readonly arrayKeyStrategies = [];

  /** 从指定版本加载完整费用配置。 */
  async load(versionId: string, tx: PrismaTransaction): Promise<FeeConfig> {
    try {
      const config = await tx.feeConfig.findUnique({ where: { configVersionId: versionId } });

      if (!config) {
        throw systemConfigNotFound();
      }

      return {
        platformCommissionBps: config.platformCommissionBps,
        rewardServiceFeeCents: config.rewardServiceFeeCents,
        withdrawalFeeBps: config.withdrawalFeeBps,
        minimumWithdrawalFeeCents: config.minimumWithdrawalFeeCents,
      };
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw systemConfigPersistenceFailed();
    }
  }

  /** 校验后原子覆盖指定版本的费用配置。 */
  async persist(versionId: string, config: FeeConfig, tx: PrismaTransaction): Promise<void> {
    this.validate(config);

    try {
      await tx.feeConfig.upsert({
        where: { configVersionId: versionId },
        update: config,
        create: { configVersionId: versionId, ...config },
      });
    } catch {
      throw systemConfigPersistenceFailed();
    }
  }

  /** 完整校验所有比例为整数万分比、所有金额为非负整数分。 */
  validate(config: FeeConfig): void {
    requireIntegerInRange(
      config.platformCommissionBps,
      0,
      5000,
      "平台抽成必须在 0 至 5000 万分比之间",
    );
    requireIntegerInRange(
      config.withdrawalFeeBps,
      0,
      1000,
      "提现手续费必须在 0 至 1000 万分比之间",
    );
    requireIntegerInRange(
      config.rewardServiceFeeCents,
      0,
      Number.MAX_SAFE_INTEGER,
      "悬赏服务费必须为非负整数分",
    );
    requireIntegerInRange(
      config.minimumWithdrawalFeeCents,
      0,
      Number.MAX_SAFE_INTEGER,
      "最低提现手续费必须为非负整数分",
    );
  }

  /** 返回用于差异比较的完整递归费用配置摘要。 */
  summarize(config: FeeConfig) {
    return { ...config };
  }
}
