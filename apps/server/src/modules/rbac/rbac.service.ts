import { Injectable } from "@nestjs/common";
import type { RbacCatalogResponse } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionCatalogService } from "./permission-catalog.service";

/** Provides catalog data and effective authorization code resolution for RBAC consumers. */
@Injectable()
export class RbacService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly permissionCatalogService: PermissionCatalogService,
  ) {}

  /** Returns the active code-defined permission catalog and its content version. */
  getCatalog(): RbacCatalogResponse {
    return {
      version: this.permissionCatalogService.getVersion(),
      permissions: [...this.permissionCatalogService.getAll()],
    };
  }

  /** Resolves an active user's role permissions, excluding database codes absent from the catalog. */
  async getEffectiveAuthorizationCodes(userId: string): Promise<string[]> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        status: "active",
        roles: { some: { role: { isActive: true } } },
      },
      select: {
        roles: {
          where: { role: { isActive: true } },
          select: {
            role: {
              select: {
                permissions: {
                  select: { permission: { select: { permissionCode: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return [
      ...new Set(
        user.roles
          .flatMap((assignment) => assignment.role.permissions)
          .map((rolePermission) => rolePermission.permission.permissionCode)
          .filter((code) => this.permissionCatalogService.isActiveCode(code)),
      ),
    ].sort();
  }
}
