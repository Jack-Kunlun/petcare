import { MODULE_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "../config/config.service";
import { AdminRbacController } from "../modules/rbac/admin-rbac.controller";
import { RbacModule } from "../modules/rbac/rbac.module";
import { AuthModule, createSmsSender } from "./auth.module";
import { PasswordLoginAttemptService } from "./password-login-attempt.service";
import { PasswordService } from "./password.service";
import { SessionValidationService } from "./session-validation.service";
import { AliyunSmsSender } from "./sms/aliyun-sms.sender";
import { DevelopmentSmsSender } from "./sms/development-sms.sender";
import { TokenService } from "./token.service";

describe("AuthModule", () => {
  it("keeps authentication and guards separate from the RBAC controller module", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as unknown[];
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as unknown[];
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule) as unknown[];

    expect(imports).not.toContain(RbacModule);
    expect(exports).not.toContain(RbacModule);
    expect(exports).not.toContain(undefined);
    expect(controllers).not.toContain(AdminRbacController);
  });

  it("provides and exports shared authentication services without creating live clients", () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as unknown[];
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as unknown[];

    expect(providers).toEqual(
      expect.arrayContaining([
        PasswordService,
        PasswordLoginAttemptService,
        TokenService,
        SessionValidationService,
      ]),
    );
    expect(exports).toEqual(
      expect.arrayContaining([PasswordService, TokenService, SessionValidationService]),
    );
  });

  it("selects Aliyun in production and development sender elsewhere", () => {
    const production = createSmsSender({
      nodeEnv: "production",
      aliyunSmsAccessKeyId: "test-access-key-id",
      aliyunSmsAccessKeySecret: "test-access-key-secret",
      aliyunSmsSignName: "系统赠送签名",
      aliyunSmsTemplateCode: "100001",
      smsCodeTtlSeconds: 300,
    } as unknown as ConfigService);
    const development = createSmsSender({ nodeEnv: "development" } as unknown as ConfigService);

    expect(production).toBeInstanceOf(AliyunSmsSender);
    expect((production as unknown as { client: { _endpoint: string } }).client._endpoint).toBe(
      "dypnsapi.aliyuncs.com",
    );
    expect(development).toBeInstanceOf(DevelopmentSmsSender);
  });
});
