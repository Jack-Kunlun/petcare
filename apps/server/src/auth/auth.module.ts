import Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";
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
import { SessionValidationService } from "./session-validation.service";
import { AliyunSmsSender } from "./sms/aliyun-sms.sender";
import { DevelopmentSmsSender } from "./sms/development-sms.sender";
import { SMS_SENDER, SmsSender } from "./sms/sms-sender";
import { TokenService } from "./token.service";
import { VerificationCodeService } from "./verification-code.service";
import { WechatApiClient } from "./wechat-api.client";
import { WechatAuthController } from "./wechat-auth.controller";
import { WechatAuthService } from "./wechat-auth.service";

export function createSmsSender(configService: ConfigService): SmsSender {
  if (configService.nodeEnv !== "production") {
    return new DevelopmentSmsSender();
  }

  const clientConfig = new $OpenApi.Config({
    accessKeyId: configService.aliyunSmsAccessKeyId,
    accessKeySecret: configService.aliyunSmsAccessKeySecret,
  });

  clientConfig.endpoint = "dysmsapi.aliyuncs.com";

  return new AliyunSmsSender(
    new Dysmsapi20170525(clientConfig),
    configService.aliyunSmsSignName,
    configService.aliyunSmsTemplateCode,
  );
}

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, WechatAuthController],
  providers: [
    RedisService,
    CaptchaService,
    PasswordService,
    VerificationCodeService,
    SessionValidationService,
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
      useFactory: createSmsSender,
    },
  ],
  exports: [
    AuthService,
    AccessTokenGuard,
    AdminGuard,
    PermissionGuard,
    DisputeResolverGuard,
    PasswordService,
    TokenService,
    SessionValidationService,
  ],
})
export class AuthModule {}
