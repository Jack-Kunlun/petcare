import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PermissionCatalogService } from "./permission-catalog.service";
import { RbacService } from "./rbac.service";
import { RoleService } from "./role.service";

/** Groups RBAC catalog access, authorization resolution, and administrative role management. */
@Module({
  imports: [PrismaModule],
  providers: [PermissionCatalogService, RbacService, RoleService],
  exports: [PermissionCatalogService, RbacService, RoleService],
})
export class RbacModule {}
