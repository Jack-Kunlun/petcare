import Dypnsapi20170525 from "@alicloud/dypnsapi20170525";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "../config/config.service";
import { AccessTokenGuard } from "./access-token.guard";
import { AdminGuard } from "./admin.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { DisputeResolverGuard } from "./dispute-resolver.guard";
import { JwtStrategy } from "./jwt.strategy";
import { PasswordLoginAttemptService } from "./password-login-attempt.service";
import { PasswordService } from "./password.service";
import { PermissionGuard } from "./permission.guard";
import { ProfileCompleteGuard } from "./profile-complete.guard";
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

  const clientConfig = new $OpenApiUtil.Config({
    accessKeyId: configService.aliyunSmsAccessKeyId,
    accessKeySecret: configService.aliyunSmsAccessKeySecret,
  });

  clientConfig.endpoint = "dypnsapi.aliyuncs.com";

  return new AliyunSmsSender(
    new Dypnsapi20170525(clientConfig),
    configService.aliyunSmsSignName,
    configService.aliyunSmsTemplateCode,
    configService.smsCodeTtlSeconds,
  );
}

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, WechatAuthController],
  providers: [
    CaptchaService,
    PasswordService,
    PasswordLoginAttemptService,
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
    ProfileCompleteGuard,
    DisputeResolverGuard,
    {
      provide: SMS_SENDER,
      inject: [ConfigService],
      useFactory: createSmsSender,
    },
  ],
  exports: [
    AuthService,
    VerificationCodeService,
    AccessTokenGuard,
    AdminGuard,
    PermissionGuard,
    ProfileCompleteGuard,
    DisputeResolverGuard,
    PasswordService,
    TokenService,
    SessionValidationService,
  ],
})
export class AuthModule {}
