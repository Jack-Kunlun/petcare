# 默认数据初始化指南

## 概述

本项目的默认数据脚本用于初始化RBAC权限系统、角色配置和测试用户。

## 文件说明

- `prisma/seed.ts` - 默认数据初始化脚本
- `package.json` - 包含seed脚本配置

## 初始化的数据

### 1. 权限点（40个）

覆盖6个模块：

- **用户管理** (user) - 6个权限
- **订单管理** (order) - 6个权限
- **内容管理** (content) - 4个权限
- **财务管理** (finance) - 4个权限
- **纠纷处理** (order) - 3个权限
- **系统设置** (system) - 7个权限
- **权限管理** (system) - 7个权限
- **数据统计** (system) - 2个权限

### 2. 角色（5个）

| 角色              | 描述       | 权限范围             |
| ----------------- | ---------- | -------------------- |
| super_admin       | 超级管理员 | 所有权限             |
| admin             | 普通管理员 | 除RBAC外的所有权限   |
| customer_service  | 客服专员   | 订单、纠纷、用户查看 |
| content_moderator | 内容审核员 | 内容管理             |
| finance_manager   | 财务管理员 | 财务管理             |

### 3. 测试用户（3个）

| 手机号      | 昵称       | 分配角色         |
| ----------- | ---------- | ---------------- |
| 13800138000 | 超级管理员 | super_admin      |
| 13800138001 | 普通管理员 | admin            |
| 13800138002 | 客服专员   | customer_service |

### 4. 信用分

为所有测试用户初始化信用分为100分。

## 使用方法

### 方式一：通过Prisma migrate自动执行

```bash
# 首次迁移时会自动执行seed
npx prisma migrate dev
```

### 方式二：手动执行seed脚本

```bash
# 使用npm script
pnpm prisma:seed

# 或直接运行
npx tsx prisma/seed.ts
```

### 方式三：在迁移后单独执行

```bash
# 先应用迁移
npx prisma migrate deploy

# 再执行seed
pnpm prisma:seed
```

## 注意事项

1. **幂等性**：脚本使用`upsert`操作，可重复执行而不会产生重复数据
2. **测试环境**：测试用户仅用于开发测试，生产环境请勿使用
3. **权限审计**：所有权限变更会记录到`PermissionAuditLog`表（需手动添加日志）
4. **自定义扩展**：可根据业务需求修改seed脚本，添加更多默认数据

## 扩展建议

### 添加更多默认数据

编辑`prisma/seed.ts`文件，在`main()`函数中添加：

```typescript
// 示例：添加默认服务类型
const serviceTypes = ["feeding", "walking", "playing"];
for (const type of serviceTypes) {
  await prisma.serviceType.upsert({
    where: { name: type },
    update: {},
    create: { name: type },
  });
}
```

### 添加SOP配置

```typescript
// 示例：添加默认SOP步骤
const sopSteps = [
  { stepNumber: 1, stepName: "进门消毒" },
  { stepNumber: 2, stepName: "拍照打卡" },
  // ...
];
```

## 故障排查

### 问题1：脚本执行失败

**原因**：数据库未连接或迁移未应用

**解决**：

```bash
# 检查数据库连接
npx prisma db pull

# 重新应用迁移
npx prisma migrate dev
```

### 问题2：重复数据错误

**原因**：唯一约束冲突

**解决**：脚本已使用`upsert`，理论上不会发生。如仍报错，检查数据库状态：

```bash
npx prisma studio
```

### 问题3：tsx命令找不到

**原因**：依赖未安装

**解决**：

```bash
pnpm install
```

---

**最后更新**: 2026-07-16  
**维护者**: PetCare 后端团队
