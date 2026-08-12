import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { ActiveAdministratorGuard } from "./active-administrator.guard";
import { AdminAccountController } from "./admin-account.controller";
import { AdminAccountService } from "./admin-account.service";

/** Groups administrator self-service profile and password endpoints. */
@Module({
  imports: [PrismaModule, AuthModule, LoggingModule],
  controllers: [AdminAccountController],
  providers: [AdminAccountService, ActiveAdministratorGuard],
})
export class AdminAccountModule {}
