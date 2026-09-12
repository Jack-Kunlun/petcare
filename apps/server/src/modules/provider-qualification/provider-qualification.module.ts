import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import {
  AdminProviderQualificationController,
  ProviderQualificationController,
  QualificationFeatureGuard,
} from "./provider-qualification.controller";
import { ProviderQualificationService } from "./provider-qualification.service";
import { QualificationStorage } from "./qualification-storage";

@Module({
  imports: [AuthModule],
  controllers: [ProviderQualificationController, AdminProviderQualificationController],
  providers: [QualificationFeatureGuard, ProviderQualificationService, QualificationStorage],
})
export class ProviderQualificationModule {}
