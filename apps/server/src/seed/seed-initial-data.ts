import { PasswordService } from "../auth/password.service";
import { PrismaClient } from "../generated/prisma/client";

export interface SeedOptions {
  username: string;
  phone: string;
  password: string;
  nickname: string;
}

const permissions = [
  { permissionCode: "user.read", permissionName: "查看用户列表", module: "user", type: "api" },
  { permissionCode: "user.create", permissionName: "创建用户", module: "user", type: "api" },
  { permissionCode: "user.update", permissionName: "更新用户", module: "user", type: "api" },
  { permissionCode: "user.delete", permissionName: "删除用户", module: "user", type: "api" },
  { permissionCode: "user.view", permissionName: "用户管理菜单", module: "user", type: "menu" },
  {
    permissionCode: "user.approve_provider",
    permissionName: "审核服务提供者",
    module: "user",
    type: "button",
  },
  { permissionCode: "order.read", permissionName: "查看订单列表", module: "order", type: "api" },
  { permissionCode: "order.create", permissionName: "创建订单", module: "order", type: "api" },
  { permissionCode: "order.update", permissionName: "更新订单", module: "order", type: "api" },
  { permissionCode: "order.cancel", permissionName: "取消订单", module: "order", type: "button" },
  { permissionCode: "order.view", permissionName: "订单管理菜单", module: "order", type: "menu" },
  {
    permissionCode: "order.export",
    permissionName: "导出订单数据",
    module: "order",
    type: "button",
  },
  {
    permissionCode: "content.read",
    permissionName: "查看社区内容",
    module: "content",
    type: "api",
  },
  {
    permissionCode: "content.delete",
    permissionName: "删除违规内容",
    module: "content",
    type: "button",
  },
  {
    permissionCode: "content.publish",
    permissionName: "发布官方内容",
    module: "content",
    type: "button",
  },
  {
    permissionCode: "content.view",
    permissionName: "内容管理菜单",
    module: "content",
    type: "menu",
  },
  {
    permissionCode: "finance.read",
    permissionName: "查看财务数据",
    module: "finance",
    type: "api",
  },
  {
    permissionCode: "finance.withdrawal_approve",
    permissionName: "审核提现",
    module: "finance",
    type: "button",
  },
  {
    permissionCode: "finance.refund",
    permissionName: "处理退款",
    module: "finance",
    type: "button",
  },
  {
    permissionCode: "finance.view",
    permissionName: "财务管理菜单",
    module: "finance",
    type: "menu",
  },
  { permissionCode: "dispute.read", permissionName: "查看投诉列表", module: "order", type: "api" },
  {
    permissionCode: "dispute.resolve",
    permissionName: "裁决纠纷",
    module: "order",
    type: "button",
  },
  { permissionCode: "dispute.view", permissionName: "纠纷处理菜单", module: "order", type: "menu" },
  { permissionCode: "system.config", permissionName: "系统配置", module: "system", type: "button" },
  {
    permissionCode: "system.sop_config",
    permissionName: "SOP配置",
    module: "system",
    type: "button",
  },
  {
    permissionCode: "system.threshold_config",
    permissionName: "评分阈值配置",
    module: "system",
    type: "button",
  },
  { permissionCode: "system.view", permissionName: "系统设置菜单", module: "system", type: "menu" },
  {
    permissionCode: "rbac.role.read",
    permissionName: "查看角色列表",
    module: "system",
    type: "api",
  },
  {
    permissionCode: "rbac.role.create",
    permissionName: "创建角色",
    module: "system",
    type: "button",
  },
  {
    permissionCode: "rbac.role.update",
    permissionName: "更新角色",
    module: "system",
    type: "button",
  },
  {
    permissionCode: "rbac.role.delete",
    permissionName: "删除角色",
    module: "system",
    type: "button",
  },
  {
    permissionCode: "rbac.permission.read",
    permissionName: "查看权限点",
    module: "system",
    type: "api",
  },
  {
    permissionCode: "rbac.assign_role",
    permissionName: "分配用户角色",
    module: "system",
    type: "button",
  },
  { permissionCode: "rbac.view", permissionName: "权限管理菜单", module: "system", type: "menu" },
  {
    permissionCode: "stats.dashboard",
    permissionName: "查看运营看板",
    module: "system",
    type: "api",
  },
  { permissionCode: "stats.view", permissionName: "数据统计菜单", module: "system", type: "menu" },
] as const;

export async function seedInitialData(
  prisma: PrismaClient,
  options: SeedOptions,
  passwordService = new PasswordService(),
): Promise<void> {
  await Promise.all(
    permissions.map((permission) =>
      prisma.permission.upsert({
        where: { permissionCode: permission.permissionCode },
        update: permission,
        create: permission,
      }),
    ),
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

  const allPermissions = await prisma.permission.findMany();

  await Promise.all(
    allPermissions.map((permission) =>
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
  const userData = {
    username: options.username,
    nickname: options.nickname,
    passwordHash,
    userType: "pet_owner",
    status: "active",
  };
  const user = await prisma.user.upsert({
    where: { phone: options.phone },
    update: userData,
    create: {
      ...userData,
      phone: options.phone,
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
