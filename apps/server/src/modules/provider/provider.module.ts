import { Module } from "@nestjs/common";
import { SystemSettingsModule } from "../system-settings/system-settings.module";
import { ProviderRatingEligibilityService } from "./provider-rating-eligibility.service";

/** 装配服务者评分资格评估能力。 */
@Module({
  imports: [SystemSettingsModule],
  providers: [ProviderRatingEligibilityService],
  exports: [ProviderRatingEligibilityService],
})
export class ProviderModule {}
