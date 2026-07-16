import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化默认数据...');

  // ============================================
  // 1. 初始化权限点
  // ============================================
  console.log('\n📋 创建权限点...');

  const permissions = [
    // 用户管理模块
    { permissionCode: 'user.read', permissionName: '查看用户列表', module: 'user', type: 'api' },
    { permissionCode: 'user.create', permissionName: '创建用户', module: 'user', type: 'api' },
    { permissionCode: 'user.update', permissionName: '更新用户', module: 'user', type: 'api' },
    { permissionCode: 'user.delete', permissionName: '删除用户', module: 'user', type: 'api' },
    { permissionCode: 'user.view', permissionName: '用户管理菜单', module: 'user', type: 'menu' },
    { permissionCode: 'user.approve_provider', permissionName: '审核服务提供者', module: 'user', type: 'button' },

    // 订单管理模块
    { permissionCode: 'order.read', permissionName: '查看订单列表', module: 'order', type: 'api' },
    { permissionCode: 'order.create', permissionName: '创建订单', module: 'order', type: 'api' },
    { permissionCode: 'order.update', permissionName: '更新订单', module: 'order', type: 'api' },
    { permissionCode: 'order.cancel', permissionName: '取消订单', module: 'order', type: 'button' },
    { permissionCode: 'order.view', permissionName: '订单管理菜单', module: 'order', type: 'menu' },
    { permissionCode: 'order.export', permissionName: '导出订单数据', module: 'order', type: 'button' },

    // 内容管理模块
    { permissionCode: 'content.read', permissionName: '查看社区内容', module: 'content', type: 'api' },
    { permissionCode: 'content.delete', permissionName: '删除违规内容', module: 'content', type: 'button' },
    { permissionCode: 'content.publish', permissionName: '发布官方内容', module: 'content', type: 'button' },
    { permissionCode: 'content.view', permissionName: '内容管理菜单', module: 'content', type: 'menu' },

    // 财务管理模块
    { permissionCode: 'finance.read', permissionName: '查看财务数据', module: 'finance', type: 'api' },
    { permissionCode: 'finance.withdrawal_approve', permissionName: '审核提现', module: 'finance', type: 'button' },
    { permissionCode: 'finance.refund', permissionName: '处理退款', module: 'finance', type: 'button' },
    { permissionCode: 'finance.view', permissionName: '财务管理菜单', module: 'finance', type: 'menu' },

    // 纠纷处理模块
    { permissionCode: 'dispute.read', permissionName: '查看投诉列表', module: 'order', type: 'api' },
    { permissionCode: 'dispute.resolve', permissionName: '裁决纠纷', module: 'order', type: 'button' },
    { permissionCode: 'dispute.view', permissionName: '纠纷处理菜单', module: 'order', type: 'menu' },

    // 系统设置模块
    { permissionCode: 'system.config', permissionName: '系统配置', module: 'system', type: 'button' },
    { permissionCode: 'system.sop_config', permissionName: 'SOP配置', module: 'system', type: 'button' },
    { permissionCode: 'system.threshold_config', permissionName: '评分阈值配置', module: 'system', type: 'button' },
    { permissionCode: 'system.view', permissionName: '系统设置菜单', module: 'system', type: 'menu' },

    // 权限管理模块（仅超级管理员）
    { permissionCode: 'rbac.role.read', permissionName: '查看角色列表', module: 'system', type: 'api' },
    { permissionCode: 'rbac.role.create', permissionName: '创建角色', module: 'system', type: 'button' },
    { permissionCode: 'rbac.role.update', permissionName: '更新角色', module: 'system', type: 'button' },
    { permissionCode: 'rbac.role.delete', permissionName: '删除角色', module: 'system', type: 'button' },
    { permissionCode: 'rbac.permission.read', permissionName: '查看权限点', module: 'system', type: 'api' },
    { permissionCode: 'rbac.assign_role', permissionName: '分配用户角色', module: 'system', type: 'button' },
    { permissionCode: 'rbac.view', permissionName: '权限管理菜单', module: 'system', type: 'menu' },

    // 数据统计模块
    { permissionCode: 'stats.dashboard', permissionName: '查看运营看板', module: 'system', type: 'api' },
    { permissionCode: 'stats.view', permissionName: '数据统计菜单', module: 'system', type: 'menu' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { permissionCode: perm.permissionCode },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ 已创建 ${permissions.length} 个权限点`);

  // ============================================
  // 2. 初始化角色
  // ============================================
  console.log('\n👥 创建角色...');

  const roles = [
    { roleName: 'super_admin', description: '超级管理员', isSystem: true },
    { roleName: 'admin', description: '普通管理员', isSystem: true },
    { roleName: 'customer_service', description: '客服专员', isSystem: true },
    { roleName: 'content_moderator', description: '内容审核员', isSystem: true },
    { roleName: 'finance_manager', description: '财务管理员', isSystem: true },
  ];

  const createdRoles = [];
  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { roleName: role.roleName },
      update: {},
      create: role,
    });
    createdRoles.push(created);
  }

  console.log(`✅ 已创建 ${roles.length} 个角色`);

  // ============================================
  // 3. 分配角色权限
  // ============================================
  console.log('\n🔐 分配角色权限...');

  // 超级管理员 - 所有权限
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles[0].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles[0].id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ 超级管理员：所有权限');

  // 普通管理员 - 除RBAC外的所有权限
  const adminPermissions = allPermissions.filter(
    (p) => !p.permissionCode.startsWith('rbac.')
  );
  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles[1].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles[1].id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ 普通管理员：除RBAC外的所有权限');

  // 客服专员 - 订单、纠纷、用户查看
  const csPermissions = allPermissions.filter((p) =>
    ['order.read', 'order.view', 'dispute.read', 'dispute.resolve', 'dispute.view', 'user.read', 'user.view'].includes(p.permissionCode)
  );
  for (const perm of csPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles[2].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles[2].id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ 客服专员：订单、纠纷、用户查看权限');

  // 内容审核员 - 内容管理
  const contentPermissions = allPermissions.filter((p) =>
    p.module === 'content' || ['user.read', 'user.view'].includes(p.permissionCode)
  );
  for (const perm of contentPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles[3].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles[3].id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ 内容审核员：内容管理权限');

  // 财务管理员 - 财务管理
  const financePermissions = allPermissions.filter((p) =>
    p.module === 'finance' || ['order.read', 'order.view', 'user.read', 'user.view'].includes(p.permissionCode)
  );
  for (const perm of financePermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: createdRoles[4].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: createdRoles[4].id,
        permissionId: perm.id,
      },
    });
  }
  console.log('✅ 财务管理员：财务管理权限');

  // ============================================
  // 4. 创建测试用户（可选）
  // ============================================
  console.log('\n🧪 创建测试用户...');

  const testUsers = [
    {
      phone: '13800138000',
      nickname: '超级管理员',
      userType: 'pet_owner',
      status: 'active',
    },
    {
      phone: '13800138001',
      nickname: '普通管理员',
      userType: 'pet_owner',
      status: 'active',
    },
    {
      phone: '13800138002',
      nickname: '客服专员',
      userType: 'pet_owner',
      status: 'active',
    },
  ];

  const createdUsers = [];
  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { phone: userData.phone },
      update: {},
      create: userData,
    });
    createdUsers.push(user);
  }

  console.log(`✅ 已创建 ${testUsers.length} 个测试用户`);

  // ============================================
  // 5. 分配测试用户角色
  // ============================================
  console.log('\n🔗 分配测试用户角色...');

  // 超级管理员用户 -> super_admin角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: createdUsers[0].id,
        roleId: createdRoles[0].id,
      },
    },
    update: {},
    create: {
      userId: createdUsers[0].id,
      roleId: createdRoles[0].id,
    },
  });
  console.log('✅ 超级管理员用户已分配super_admin角色');

  // 普通管理员用户 -> admin角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: createdUsers[1].id,
        roleId: createdRoles[1].id,
      },
    },
    update: {},
    create: {
      userId: createdUsers[1].id,
      roleId: createdRoles[1].id,
    },
  });
  console.log('✅ 普通管理员用户已分配admin角色');

  // 客服专员用户 -> customer_service角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: createdUsers[2].id,
        roleId: createdRoles[2].id,
      },
    },
    update: {},
    create: {
      userId: createdUsers[2].id,
      roleId: createdRoles[2].id,
    },
  });
  console.log('✅ 客服专员用户已分配customer_service角色');

  // ============================================
  // 6. 初始化信用分
  // ============================================
  console.log('\n💳 初始化信用分...');

  for (const user of createdUsers) {
    await prisma.creditScore.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        creditScore: 100,
      },
    });
  }

  console.log(`✅ 已为 ${createdUsers.length} 个用户初始化信用分`);

  console.log('\n✨ 默认数据初始化完成！\n');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
