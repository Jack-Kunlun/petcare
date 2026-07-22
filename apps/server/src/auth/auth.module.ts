import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "../config/config.service";
import { RedisService } from "../config/redis.service";
import { AccessTokenGuard } from "./access-token.guard";
import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { JwtStrategy } from "./jwt.strategy";
import { PasswordService } from "./password.service";
import { DevelopmentSmsSender } from "./sms/development-sms.sender";
import { SMS_SENDER } from "./sms/sms-sender";
import { TokenService } from "./token.service";
import { VerificationCodeService } from "./verification-code.service";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    RedisService,
    CaptchaService,
    PasswordService,
    VerificationCodeService,
    TokenService,
    AuthService,
    JwtStrategy,
    AccessTokenGuard,
    AdminGuard,
    {
      provide: SMS_SENDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.nodeEnv === "production") {
          throw new Error("Production SMS sender is not configured");
        }

        return new DevelopmentSmsSender();
      },
    },
  ],
  exports: [AuthService, AccessTokenGuard, AdminGuard],
})
export class AuthModule {}
