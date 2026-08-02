import { MODULE_METADATA } from "@nestjs/common/constants";
import { AdminRbacController } from "../modules/rbac/admin-rbac.controller";
import { RbacModule } from "../modules/rbac/rbac.module";
import { AuthModule } from "./auth.module";

describe("AuthModule", () => {
  it("imports RBAC services through a forward-ref cycle without owning or re-exporting its controller module", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as unknown[];
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, AuthModule) as unknown[];
    const rbacImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RbacModule) as unknown[];
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AuthModule) as unknown[];

    expect(
      imports.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "forwardRef" in entry &&
          (entry as { forwardRef: () => unknown }).forwardRef() === RbacModule,
      ),
    ).toBe(true);
    expect(exports).not.toContain(RbacModule);
    expect(exports).not.toContain(undefined);
    expect(
      rbacImports.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "forwardRef" in entry &&
          (entry as { forwardRef: () => unknown }).forwardRef() === AuthModule,
      ),
    ).toBe(true);
    expect(controllers).not.toContain(AdminRbacController);
  });
});
