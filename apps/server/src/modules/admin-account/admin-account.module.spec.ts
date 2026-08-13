import { MODULE_METADATA } from "@nestjs/common/constants";
import { AppModule } from "../../app.module";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PublicAvatarStorageModule } from "../../public-avatar-storage/public-avatar-storage.module";
import { ActiveAdministratorGuard } from "./active-administrator.guard";
import { AdminAccountController } from "./admin-account.controller";
import { AdminAccountModule } from "./admin-account.module";
import { AdminAccountService } from "./admin-account.service";

describe("AdminAccountModule", () => {
  it("wires the account slice and registers it in the application", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AdminAccountModule)).toEqual(
      expect.arrayContaining([PrismaModule, AuthModule, LoggingModule, PublicAvatarStorageModule]),
    );
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminAccountModule)).toEqual([
      AdminAccountController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AdminAccountModule)).toEqual(
      expect.arrayContaining([AdminAccountService, ActiveAdministratorGuard]),
    );
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)).toEqual(
      expect.arrayContaining([AdminAccountModule]),
    );
  });
});
