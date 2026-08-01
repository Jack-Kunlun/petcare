import { Module } from "@nestjs/common";
import { AdminServiceType } from "@petcare/shared-types";
import { AuthModule } from "../../auth/auth.module";
import { AdminSystemSettingsController } from "./admin-system-settings.controller";
import { FeeConfigAdapter } from "./fee/fee-config.adapter";
import { ConfigDiffService } from "./publishing/config-diff.service";
import { CONFIG_DOMAIN_ADAPTERS, ConfigDomainAdapter } from "./publishing/config-domain.adapter";
import { ConfigPublishingService } from "./publishing/config-publishing.service";
import { RatingThresholdAdapter } from "./rating-threshold/rating-threshold.adapter";
import { SopConfigAdapter } from "./sop/sop-config.adapter";
import { SystemSettingsOverviewService } from "./system-settings-overview.service";

const SOP_FEEDING_ADAPTER = Symbol("SOP_FEEDING_ADAPTER");
const SOP_WALKING_ADAPTER = Symbol("SOP_WALKING_ADAPTER");
const SOP_PLAYING_ADAPTER = Symbol("SOP_PLAYING_ADAPTER");

function sopAdapter(serviceType: AdminServiceType): SopConfigAdapter {
  return new SopConfigAdapter(serviceType);
}

/** 装配三个强类型配置领域、发布内核和后台系统设置接口。 */
@Module({
  imports: [AuthModule],
  controllers: [AdminSystemSettingsController],
  providers: [
    ConfigDiffService,
    ConfigPublishingService,
    RatingThresholdAdapter,
    FeeConfigAdapter,
    { provide: SOP_FEEDING_ADAPTER, useFactory: () => sopAdapter("feeding") },
    { provide: SOP_WALKING_ADAPTER, useFactory: () => sopAdapter("walking") },
    { provide: SOP_PLAYING_ADAPTER, useFactory: () => sopAdapter("playing") },
    {
      provide: CONFIG_DOMAIN_ADAPTERS,
      inject: [
        SOP_FEEDING_ADAPTER,
        SOP_WALKING_ADAPTER,
        SOP_PLAYING_ADAPTER,
        RatingThresholdAdapter,
        FeeConfigAdapter,
      ],
      useFactory: (...adapters: ConfigDomainAdapter<unknown>[]) => adapters,
    },
    SystemSettingsOverviewService,
  ],
  exports: [ConfigPublishingService, SystemSettingsOverviewService],
})
export class SystemSettingsModule {}
