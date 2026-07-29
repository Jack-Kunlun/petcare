import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { AdminProviderCertificationController } from "./admin-provider-certification.controller";
import { ProviderCertificationService } from "./provider-certification.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminProviderCertificationController],
  providers: [ProviderCertificationService],
})
export class ProviderCertificationModule {}
