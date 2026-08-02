import { MODULE_METADATA } from "@nestjs/common/constants";
import { AdminRbacController } from "../modules/rbac/admin-rbac.controller";
import { RbacModule } from "../modules/rbac/rbac.module";
import { AuthModule } from "./auth.module";

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
});
