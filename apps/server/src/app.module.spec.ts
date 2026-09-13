import { MODULE_METADATA } from "@nestjs/common/constants";
import { AppModule } from "./app.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { AdminAccountModule } from "./modules/admin-account/admin-account.module";
import { BountyModule } from "./modules/bounty/bounty.module";
import { ContentModule } from "./modules/content/content.module";
import { PaymentController, PaymentFeatureGuard } from "./modules/payment/payment.controller";
import { PaymentModule } from "./modules/payment/payment.module";
import { PetModule } from "./modules/pet/pet.module";
import { ProviderQualificationModule } from "./modules/provider-qualification/provider-qualification.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { UserModule } from "./modules/user/user.module";
import { WebsiteContentModule } from "./modules/website-content/website-content.module";
import { PrismaModule } from "./prisma/prisma.module";

describe("AppModule", () => {
  it("registers current capabilities including the gated bounty and qualification modules", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];

    expect(imports).toEqual([
      ConfigModule,
      LoggingModule,
      PrismaModule,
      AuthModule,
      HealthModule,
      UserModule,
      PetModule,
      PaymentModule,
      ContentModule,
      RbacModule,
      AdminAccountModule,
      BountyModule,
      ProviderQualificationModule,
      WebsiteContentModule,
    ]);
  });

  it("registers payment routes behind a default-closed feature guard", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PaymentModule)).toEqual([
      PaymentController,
    ]);
    expect(() => new PaymentFeatureGuard({ wechatPay: null } as never).canActivate()).toThrow(
      "支付服务未开放",
    );
  });
});
