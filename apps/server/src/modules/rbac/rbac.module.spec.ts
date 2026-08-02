import { MODULE_METADATA } from "@nestjs/common/constants";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { AdminRbacController } from "./admin-rbac.controller";
import { RbacModule } from "./rbac.module";

describe("RbacModule", () => {
  it("owns the admin RBAC controller and imports authentication guards", () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, RbacModule) as unknown[];
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, RbacModule) as unknown[];

    expect(controllers).toContain(AdminRbacController);
    expect(imports).toContain(LoggingModule);
    expect(imports).toContain(AuthModule);
  });
});
