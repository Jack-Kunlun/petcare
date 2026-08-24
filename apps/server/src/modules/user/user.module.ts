import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { ConfigModule } from "../../config/config.module";
import { LoggingModule } from "../../logging/logging.module";
import { PublicAvatarStorageModule } from "../../public-avatar-storage/public-avatar-storage.module";
import { AdminUserController } from "./admin-user.controller";
import { MiniappAccountController } from "./miniapp-account.controller";
import { MiniappAccountService } from "./miniapp-account.service";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [AuthModule, ConfigModule, LoggingModule, PublicAvatarStorageModule],
  controllers: [AdminUserController, MiniappAccountController, UserController],
  providers: [UserService, MiniappAccountService],
  exports: [UserService],
})
export class UserModule {}
