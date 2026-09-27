import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { BountyModule } from "../bounty/bounty.module";
import { AdminSettlementController, SettlementController } from "./settlement.controller";
import { SettlementService } from "./settlement.service";

/** Registers the Cycle 10 immutable income projection and withdrawal gate. */
@Module({
  imports: [AuthModule, BountyModule],
  controllers: [SettlementController, AdminSettlementController],
  providers: [SettlementService],
})
export class SettlementModule {}
