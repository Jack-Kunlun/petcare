import { MODULE_METADATA } from "@nestjs/common/constants";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { AdminRbacController } from "./admin-rbac.controller";
import { RbacModule } from "./rbac.module";

describe("RbacModule", () => {
  it("owns the admin RBAC controller and imports auth guards through a forward ref", () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, RbacModule) as unknown[];
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RbacModule) as unknown[];

    expect(controllers).toContain(AdminRbacController);
    expect(imports).toContain(LoggingModule);
    expect(
      imports.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "forwardRef" in entry &&
          (entry as { forwardRef: () => unknown }).forwardRef() === AuthModule,
      ),
    ).toBe(true);
  });
});
