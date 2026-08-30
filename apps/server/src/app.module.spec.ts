import { MODULE_METADATA } from "@nestjs/common/constants";
import { AppModule } from "./app.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { AdminAccountModule } from "./modules/admin-account/admin-account.module";
import { BountyModule } from "./modules/bounty/bounty.module";
import { ContentModule } from "./modules/content/content.module";
import { PetModule } from "./modules/pet/pet.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { UserModule } from "./modules/user/user.module";
import { WebsiteContentModule } from "./modules/website-content/website-content.module";
import { PrismaModule } from "./prisma/prisma.module";

describe("AppModule", () => {
  it("registers current capabilities including the feature-gated bounty module", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];

    expect(imports).toEqual([
      ConfigModule,
      LoggingModule,
      PrismaModule,
      AuthModule,
      HealthModule,
      UserModule,
      PetModule,
      ContentModule,
      RbacModule,
      AdminAccountModule,
      BountyModule,
      WebsiteContentModule,
    ]);
  });
});
