import { MODULE_METADATA } from "@nestjs/common/constants";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { PublicAvatarStorageModule } from "../../public-avatar-storage/public-avatar-storage.module";
import { AdminUserController } from "./admin-user.controller";
import { MiniappAccountController } from "./miniapp-account.controller";
import { MiniappAccountService } from "./miniapp-account.service";
import { UserController } from "./user.controller";
import { UserModule } from "./user.module";

describe("UserModule", () => {
  it("registers fixed current-user routes before the public id route", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, UserModule)).toEqual(
      expect.arrayContaining([AuthModule, LoggingModule, PublicAvatarStorageModule]),
    );
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, UserModule)).toEqual([
      AdminUserController,
      MiniappAccountController,
      UserController,
    ]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UserModule)).toEqual(
      expect.arrayContaining([MiniappAccountService]),
    );
  });
});
