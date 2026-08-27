import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  AdminUserListItem,
  CreateRbacRoleRequest,
  RbacRoleDetail,
  RbacRoleListItem,
  RbacRoleListQuery,
  RbacRoleListResponse,
  ReplaceRbacRolePermissionsRequest,
  ReplaceRbacRoleUsersRequest,
  UpdateRbacRoleRequest,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { PrismaService } from "../../prisma/prisma.service";
import { PermissionCatalogService } from "./permission-catalog.service";
import {
  rbacPermissionNotSynchronized,
  rbacRoleHasAssignedUsers,
  rbacRoleNameConflict,
  rbacRoleNotFound,
  rbacSystemRoleProtected,
  rbacUserNotFound,
} from "./rbac.errors";

/** Identity and source IP recorded for an RBAC mutation. */
export interface RbacAuditActor {
  operatorId: string;
  ip?: string;
}

const roleListInclude = {
  _count: { select: { permissions: true, users: true } },
} as const;

const roleDetailInclude = {
  ...roleListInclude,
  permissions: { select: { permission: { select: { permissionCode: true } } } },
  users: { select: { userId: true } },
} as const;

const adminUserSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  userType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Owns role CRUD, permission assignment, administrator assignment, and RBAC audit writes. */
@Injectable()
export class RoleService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly permissionCatalogService: PermissionCatalogService,
  ) {}

  /** Lists roles using the platform-standard list/total/page/pageSize response shape. */
  async list(query: RbacRoleListQuery): Promise<RbacRoleListResponse> {
    const roleName = query.roleName?.trim();
    const where = {
      ...(roleName ? { roleName: { contains: roleName, mode: "insensitive" as const } } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [roles, total] = await Promise.all([
      this.prismaService.role.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: roleListInclude,
      }),
      this.prismaService.role.count({ where }),
    ]);

    return {
      list: roles.map((role) => this.toRoleListItem(role)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns a role with all effective database permission codes and assigned user identifiers. */
  async get(id: string): Promise<RbacRoleDetail> {
    return this.getWithClient(this.prismaService, id);
  }

  /** Creates a normal role and its audit record as one transaction. */
  async create(dto: CreateRbacRoleRequest, actor: RbacAuditActor): Promise<RbacRoleDetail> {
    const roleName = this.normalizedRoleName(dto.roleName);

    this.requireActor(actor);

    return this.prismaService.$transaction(async (tx) => {
      const existing = await tx.role.findUnique({ where: { roleName }, select: { id: true } });

      if (existing) {
        throw rbacRoleNameConflict(roleName);
      }

      const role = await tx.role.create({
        data: { roleName, description: this.normalizedDescription(dto.description) },
        select: { id: true },
      });

      await this.writeAudit(tx, actor, "create_role", "role", role.id, { roleName });

      return this.getWithClient(tx, role.id);
    });
  }

  /** Updates a normal role and records the resulting replacement fields atomically. */
  async update(
    id: string,
    dto: UpdateRbacRoleRequest,
    actor: RbacAuditActor,
  ): Promise<RbacRoleDetail> {
    this.requireActor(actor);

    return this.prismaService.$transaction(async (tx) => {
      const role = await this.findRole(tx, id);

      this.assertMutable(role);
      const roleName =
        dto.roleName === undefined ? undefined : this.normalizedRoleName(dto.roleName);

      if (roleName && roleName !== role.roleName) {
        const existing = await tx.role.findUnique({ where: { roleName }, select: { id: true } });

        if (existing) {
          throw rbacRoleNameConflict(roleName);
        }
      }

      const data = {
        ...(roleName === undefined ? {} : { roleName }),
        ...(dto.description === undefined
          ? {}
          : { description: this.normalizedDescription(dto.description) }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      };

      await tx.role.update({ where: { id }, data });
      await this.writeAudit(tx, actor, "update_role", "role", id, data);

      return this.getWithClient(tx, id);
    });
  }

  /** Deletes an unassigned normal role and writes the deletion audit record in one transaction. */
  async delete(id: string, actor: RbacAuditActor): Promise<void> {
    this.requireActor(actor);

    await this.prismaService.$transaction(async (tx) => {
      const role = await this.findRole(tx, id);

      this.assertMutable(role);
      const userCount = await tx.userRole.count({ where: { roleId: id } });

      if (userCount > 0) {
        throw rbacRoleHasAssignedUsers(id);
      }

      await tx.role.delete({ where: { id } });
      await this.writeAudit(tx, actor, "delete_role", "role", id, { roleName: role.roleName });
    });
  }

  /** Atomically replaces role permissions with the validated effective UI-plus-API closure. */
  async replacePermissions(
    id: string,
    dto: ReplaceRbacRolePermissionsRequest,
    actor: RbacAuditActor,
  ): Promise<RbacRoleDetail> {
    this.requireActor(actor);
    const effectiveCodes = this.permissionCatalogService.expandToEffectiveCodes(
      dto.permissionCodes,
    );

    return this.prismaService.$transaction(async (tx) => {
      const role = await this.findRole(tx, id);

      this.assertMutable(role);
      const permissions = await tx.permission.findMany({
        where: { permissionCode: { in: effectiveCodes } },
        select: { id: true, permissionCode: true },
      });
      const permissionIdsByCode = new Map(
        permissions.map((permission) => [permission.permissionCode, permission.id]),
      );
      const missingCode = effectiveCodes.find((code) => !permissionIdsByCode.has(code));

      if (missingCode) {
        throw rbacPermissionNotSynchronized(missingCode);
      }

      await tx.rolePermission.deleteMany({ where: { roleId: id } });

      if (effectiveCodes.length > 0) {
        await tx.rolePermission.createMany({
          data: effectiveCodes.map((code) => ({
            roleId: id,
            permissionId: permissionIdsByCode.get(code)!,
          })),
        });
      }

      await this.writeAudit(tx, actor, "assign_permission", "role", id, {
        permissionCodes: effectiveCodes,
      });

      return this.getWithClient(tx, id);
    });
  }

  /** Returns complete admin-user records associated with a role. */
  async getUsers(id: string): Promise<AdminUserListItem[]> {
    await this.findRole(this.prismaService, id);
    const users = await this.prismaService.user.findMany({
      where: { roles: { some: { roleId: id } } },
      orderBy: { createdAt: "desc" },
      select: adminUserSelect,
    });

    return users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })) as AdminUserListItem[];
  }

  /** Atomically replaces all users assigned to a normal role after validating the complete ID set. */
  async replaceUsers(
    id: string,
    dto: ReplaceRbacRoleUsersRequest,
    actor: RbacAuditActor,
  ): Promise<AdminUserListItem[]> {
    this.requireActor(actor);
    const userIds = [...new Set(dto.userIds)].sort();
    const users = await this.prismaService.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    const existingUserIds = new Set(users.map((user) => user.id));
    const missingUserId = userIds.find((userId) => !existingUserIds.has(userId));

    if (missingUserId) {
      throw rbacUserNotFound(missingUserId);
    }

    return this.prismaService.$transaction(async (tx) => {
      const role = await this.findRole(tx, id);

      this.assertMutable(role);

      await tx.userRole.deleteMany({ where: { roleId: id } });

      if (userIds.length > 0) {
        await tx.userRole.createMany({
          data: userIds.map((userId) => ({ roleId: id, userId })),
        });
      }

      await this.writeAudit(tx, actor, "assign_user_role", "role", id, { userIds });

      const assignedUsers = await tx.user.findMany({
        where: { id: { in: userIds } },
        orderBy: { createdAt: "desc" },
        select: adminUserSelect,
      });

      return assignedUsers.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })) as AdminUserListItem[];
    });
  }

  private async getWithClient(
    client: Pick<PrismaService, "role">,
    id: string,
  ): Promise<RbacRoleDetail> {
    const role = await client.role.findUnique({ where: { id }, include: roleDetailInclude });

    if (!role) {
      throw rbacRoleNotFound(id);
    }

    return {
      ...this.toRoleListItem(role),
      permissionCodes: role.permissions.map(({ permission }) => permission.permissionCode).sort(),
      userIds: role.users.map(({ userId }) => userId).sort(),
    };
  }

  private async findRole(client: Pick<PrismaService, "role">, id: string) {
    const role = await client.role.findUnique({ where: { id } });

    if (!role) {
      throw rbacRoleNotFound(id);
    }

    return role;
  }

  private assertMutable(role: { id: string; isSystem: boolean }): void {
    if (role.isSystem) {
      throw rbacSystemRoleProtected(role.id);
    }
  }

  private toRoleListItem(role: {
    id: string;
    roleName: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    updatedAt: Date;
    _count: { permissions: number; users: number };
  }): RbacRoleListItem {
    return {
      id: role.id,
      roleName: role.roleName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissionCount: role._count.permissions,
      userCount: role._count.users,
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  private normalizedRoleName(value: string): string {
    const roleName = value.trim();

    if (roleName.length === 0 || roleName.length > 50) {
      throw new ApiException("RBAC_INVALID_ROLE_NAME", "角色名称无效", HttpStatus.BAD_REQUEST);
    }

    return roleName;
  }

  private normalizedDescription(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const description = value.trim();

    if (description.length > 200) {
      throw new ApiException(
        "RBAC_INVALID_ROLE_DESCRIPTION",
        "角色说明无效",
        HttpStatus.BAD_REQUEST,
      );
    }

    return description || null;
  }

  private requireActor(actor: RbacAuditActor): void {
    if (!actor.operatorId?.trim()) {
      throw new ApiException("RBAC_INVALID_OPERATOR", "操作人身份无效", HttpStatus.UNAUTHORIZED);
    }
  }

  private async writeAudit(
    client: Pick<PrismaService, "permissionAuditLog">,
    actor: RbacAuditActor,
    operationType: string,
    targetType: string,
    targetId: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await client.permissionAuditLog.create({
      data: {
        operatorId: actor.operatorId,
        operationType,
        targetType,
        targetId,
        changes: JSON.stringify(changes),
        ip: actor.ip ?? null,
      },
    });
  }
}
