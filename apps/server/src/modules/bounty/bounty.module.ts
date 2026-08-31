import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { WebsiteContentModule } from "../website-content/website-content.module";
import { BountyController, BountyFeatureGuard } from "./bounty.controller";
import { BountyService } from "./bounty.service";

/** Registers default-closed Cycle 5–7 bounty capabilities. */
@Module({
  imports: [AuthModule, WebsiteContentModule],
  controllers: [BountyController],
  providers: [BountyService, BountyFeatureGuard],
})
export class BountyModule {}
