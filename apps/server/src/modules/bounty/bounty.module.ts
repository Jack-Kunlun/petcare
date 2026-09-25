import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { WebsiteContentModule } from "../website-content/website-content.module";
import { AdminBountyController } from "./admin-bounty.controller";
import { BountyController, BountyFeatureGuard } from "./bounty.controller";
import { BountyService } from "./bounty.service";

/** Registers default-closed Cycle 5–7 bounty capabilities. */
@Module({
  imports: [AuthModule, WebsiteContentModule],
  controllers: [BountyController, AdminBountyController],
  providers: [BountyService, BountyFeatureGuard],
})
export class BountyModule {}
