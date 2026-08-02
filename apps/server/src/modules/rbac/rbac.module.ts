import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { LoggingModule } from "../../logging/logging.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AdminRbacController } from "./admin-rbac.controller";
import { PermissionCatalogService } from "./permission-catalog.service";
import { RbacService } from "./rbac.service";
import { RoleService } from "./role.service";

/** Groups RBAC catalog access, authorization resolution, and administrative role management. */
@Module({
  imports: [PrismaModule, LoggingModule, forwardRef(() => AuthModule)],
  controllers: [AdminRbacController],
  providers: [PermissionCatalogService, RbacService, RoleService],
  exports: [PermissionCatalogService, RbacService, RoleService],
})
export class RbacModule {}
