import {
  SystemConfigArrayKeyStrategy,
  SystemConfigDomain,
  SystemConfigSummaryValue,
} from "@petcare/shared-types";
import { Prisma } from "../../../generated/prisma/client";

/** Prisma 事务客户端，确保领域配置与版本元数据原子写入。 */
export type PrismaTransaction = Prisma.TransactionClient;

/** Nest 注入全部配置领域适配器时使用的令牌。 */
export const CONFIG_DOMAIN_ADAPTERS = Symbol("CONFIG_DOMAIN_ADAPTERS");

/**
 * 配置领域与共享发布内核之间的最小边界。
 *
 * @typeParam TConfig 领域配置的强类型结构。
 */
export interface ConfigDomainAdapter<TConfig> {
  /** 适配器负责的配置领域。 */
  readonly domain: SystemConfigDomain;
  /** 摘要内各数组字段使用的单字段或复合稳定键策略。 */
  readonly arrayKeyStrategies: SystemConfigArrayKeyStrategy[];
  /** 从指定版本完整加载领域配置。 */
  load(versionId: string, tx: PrismaTransaction): Promise<TConfig>;
  /** 将完整领域配置持久化到指定版本。 */
  persist(versionId: string, config: TConfig, tx: PrismaTransaction): Promise<void>;
  /** 在保存或发布前校验完整领域配置。 */
  validate(config: TConfig): void;
  /** 转换为不含敏感正文、适合比较和展示的字段摘要。 */
  summarize(config: TConfig): SystemConfigSummaryValue;
}
