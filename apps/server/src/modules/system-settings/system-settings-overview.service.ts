import { Inject, Injectable } from "@nestjs/common";
import {
  AdminServiceType,
  FeeConfig,
  RatingThresholdConfig,
  SopConfig,
  SopConfigKey,
  SystemConfigDomain,
  SystemConfigVersion as PublishedConfigVersion,
  SystemSettingDomainOverview,
  SystemSettingsOverviewResponse,
} from "@petcare/shared-types";
import { SystemConfigVersion } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CONFIG_DOMAIN_ADAPTERS,
  ConfigDomainAdapter,
  PrismaTransaction,
} from "./publishing/config-domain.adapter";
import { ConfigPublishingService } from "./publishing/config-publishing.service";
import { systemConfigNotFound } from "./system-settings.errors";

/** 将服务类型转换为对应的稳定 SOP 配置键。 */
export function sopConfigKey(serviceType: AdminServiceType): SopConfigKey {
  return `sop:${serviceType}`;
}

/** 查询当前发布配置并装配系统设置控制台概览。 */
@Injectable()
export class SystemSettingsOverviewService {
  private readonly adapters: Map<SystemConfigDomain, ConfigDomainAdapter<unknown>>;

  /** 创建使用发布内核和领域适配器的概览查询服务。 */
  constructor(
    private readonly prisma: PrismaService,
    private readonly publishing: ConfigPublishingService,
    @Inject(CONFIG_DOMAIN_ADAPTERS) adapters: ConfigDomainAdapter<unknown>[],
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.domain, adapter]));
  }

  /** 精确读取配置键当前指针指向的已发布版本。 */
  async getCurrent<TConfig>(
    domain: SystemConfigDomain,
  ): Promise<PublishedConfigVersion<TConfig> | null> {
    const pointer = await this.prisma.systemConfigPointer.findUnique({
      where: { configKey: domain },
      include: { publishedVersion: true },
    });

    if (!pointer) {
      return null;
    }

    const adapter = this.adapters.get(domain);

    if (!adapter) {
      throw systemConfigNotFound();
    }

    const config = (await adapter.load(
      pointer.publishedVersionId,
      this.prisma as unknown as PrismaTransaction,
    )) as TConfig;

    return this.toPublished(pointer.publishedVersion, config);
  }

  /** 返回所有 SOP 服务类型、评分阈值和费用配置的发布与草稿概览。 */
  async getOverview(): Promise<SystemSettingsOverviewResponse> {
    const [feeding, walking, playing, ratingThreshold, fee] = await Promise.all([
      this.getDomainOverview<SopConfig>(sopConfigKey("feeding")),
      this.getDomainOverview<SopConfig>(sopConfigKey("walking")),
      this.getDomainOverview<SopConfig>(sopConfigKey("playing")),
      this.getDomainOverview<RatingThresholdConfig>("rating_threshold"),
      this.getDomainOverview<FeeConfig>("fee"),
    ]);

    return {
      sop: { feeding, walking, playing },
      ratingThreshold,
      fee,
    };
  }

  private async getDomainOverview<TConfig>(
    domain: SystemConfigDomain,
  ): Promise<SystemSettingDomainOverview<TConfig>> {
    const [current, draft] = await Promise.all([
      this.getCurrent<TConfig>(domain),
      this.publishing.getDraft<TConfig>(domain),
    ]);

    return {
      current,
      draft,
      pendingActions: draft ? ["存在待发布草稿"] : [],
    };
  }

  private toPublished<TConfig>(
    version: SystemConfigVersion,
    config: TConfig,
  ): PublishedConfigVersion<TConfig> {
    return {
      id: version.id,
      domain: version.configKey as SystemConfigDomain,
      version: version.businessVersion,
      status: version.status as PublishedConfigVersion<TConfig>["status"],
      config,
      changeSummary: version.changeSummary,
      publishedBy: version.publishedById ?? "",
      publishedAt: version.publishedAt?.toISOString() ?? "",
    };
  }
}
