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
import { DisputeResolverGuard } from "./dispute-resolver.guard";
import { JwtStrategy } from "./jwt.strategy";
import { PasswordService } from "./password.service";
import { PermissionGuard } from "./permission.guard";
import { DevelopmentSmsSender } from "./sms/development-sms.sender";
import { SMS_SENDER } from "./sms/sms-sender";
import { TokenService } from "./token.service";
import { VerificationCodeService } from "./verification-code.service";
import { WechatApiClient } from "./wechat-api.client";
import { WechatAuthController } from "./wechat-auth.controller";
import { WechatAuthService } from "./wechat-auth.service";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, WechatAuthController],
  providers: [
    RedisService,
    CaptchaService,
    PasswordService,
    VerificationCodeService,
    TokenService,
    AuthService,
    WechatApiClient,
    WechatAuthService,
    JwtStrategy,
    AccessTokenGuard,
    AdminGuard,
    PermissionGuard,
    DisputeResolverGuard,
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
  exports: [AuthService, AccessTokenGuard, AdminGuard, PermissionGuard, DisputeResolverGuard],
})
export class AuthModule {}
