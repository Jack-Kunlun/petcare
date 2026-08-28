import { RBAC_PERMISSION_CATALOG } from "@petcare/shared-types";
import { PasswordService } from "../auth/password.service";
import { PrismaClient } from "../generated/prisma/client";

export interface SeedOptions {
  username: string;
  password: string;
  nickname: string;
}

export async function seedInitialData(
  prisma: PrismaClient,
  options: SeedOptions,
  passwordService = new PasswordService(),
): Promise<void> {
  const catalogPermissions = await Promise.all(
    RBAC_PERMISSION_CATALOG.map((permission) => {
      const data = {
        permissionCode: permission.code,
        permissionName: permission.label,
        module: permission.module,
        type: permission.type,
      };

      return prisma.permission.upsert({
        where: { permissionCode: permission.code },
        update: data,
        create: data,
      });
    }),
  );

  const role = await prisma.role.upsert({
    where: { roleName: "super_admin" },
    update: {
      description: "拥有全部系统权限的默认超级管理员角色",
      isSystem: true,
      isActive: true,
    },
    create: {
      roleName: "super_admin",
      description: "拥有全部系统权限的默认超级管理员角色",
      isSystem: true,
      isActive: true,
    },
  });

  await Promise.all(
    catalogPermissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  const passwordHash = await passwordService.hash(options.password);
  const user = await prisma.user.upsert({
    where: { username: options.username },
    update: { phone: null },
    create: {
      phone: null,
      username: options.username,
      nickname: options.nickname,
      passwordHash,
      userType: "pet_owner",
      status: "active",
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });
}
