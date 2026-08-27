import { MODULE_METADATA } from "@nestjs/common/constants";
import { AppModule } from "./app.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { AdminAccountModule } from "./modules/admin-account/admin-account.module";
import { ComplaintDisputeModule } from "./modules/complaint-dispute/complaint-dispute.module";
import { ContentModule } from "./modules/content/content.module";
import { OrderModule } from "./modules/order/order.module";
import { PetModule } from "./modules/pet/pet.module";
import { ProviderModule } from "./modules/provider/provider.module";
import { ProviderCertificationModule } from "./modules/provider-certification/provider-certification.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { SystemSettingsModule } from "./modules/system-settings/system-settings.module";
import { UserModule } from "./modules/user/user.module";
import { WebsiteContentModule } from "./modules/website-content/website-content.module";

describe("AppModule", () => {
  it("registers current personal capabilities without paused commercial modules", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];

    expect(imports).toEqual(
      expect.arrayContaining([
        AuthModule,
        HealthModule,
        UserModule,
        PetModule,
        ContentModule,
        RbacModule,
        AdminAccountModule,
        WebsiteContentModule,
      ]),
    );

    for (const pausedModule of [
      OrderModule,
      ComplaintDisputeModule,
      ProviderCertificationModule,
      ProviderModule,
      SystemSettingsModule,
    ]) {
      expect(imports).not.toContain(pausedModule);
    }
  });
});
