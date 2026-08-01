import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AdminComplaintController } from "./admin-complaint.controller";
import { ComplaintCommandService } from "./complaint-command.service";
import { ComplaintDeadlineService } from "./complaint-deadline.service";
import { ComplaintQueryService } from "./complaint-query.service";
import { ComplaintController } from "./complaint.controller";
import { DisputeDecisionService } from "./dispute-decision.service";
import { DisputeExecutionService } from "./dispute-execution.service";

@Module({
  imports: [AuthModule, PrismaModule, LoggingModule],
  controllers: [ComplaintController, AdminComplaintController],
  providers: [
    ComplaintCommandService,
    ComplaintQueryService,
    DisputeDecisionService,
    DisputeExecutionService,
    ComplaintDeadlineService,
  ],
  exports: [DisputeExecutionService, ComplaintDeadlineService],
})
export class ComplaintDisputeModule {}
