import { MODULE_METADATA } from "@nestjs/common/constants";
import { RbacModule } from "../modules/rbac/rbac.module";
import { AuthModule } from "./auth.module";

describe("AuthModule", () => {
  it("re-exports RBAC catalog and authorization services without a reverse RbacModule dependency", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as unknown[];
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as unknown[];
    const rbacImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RbacModule) as unknown[];

    expect(imports).toContain(RbacModule);
    expect(exports).toContain(RbacModule);
    expect(rbacImports).not.toContain(AuthModule);
  });
});
