import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { ConfigModule } from "../../config/config.module";
import { AdminUserController } from "./admin-user.controller";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [AdminUserController, UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
