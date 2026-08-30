import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { BountyController, BountyFeatureGuard } from "./bounty.controller";
import { BountyService } from "./bounty.service";

/** Registers default-closed Cycle 5 bounty capabilities. */
@Module({
  imports: [AuthModule],
  controllers: [BountyController],
  providers: [BountyService, BountyFeatureGuard],
})
export class BountyModule {}
