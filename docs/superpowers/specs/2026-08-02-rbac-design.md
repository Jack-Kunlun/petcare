# PetCare RBAC 权限管理设计

## 1. 背景与目标

当前项目已经具备 `Role`、`Permission`、`RolePermission`、`UserRole`、`PermissionAuditLog` 数据模型，Server 也有 `PermissionGuard` 和 `RequirePermissions`，Admin 已能根据当前用户权限保护部分路由。但权限点仍主要由 seed 静态维护，缺少角色管理、菜单目录和按钮级授权界面。

本次建设目标：

1. 使用共享权限目录作为菜单、按钮和 API 权限的唯一代码来源。
2. 让 Admin 路由、侧边栏和按钮权限从代码路由注册表生成，不在数据库中维护菜单结构。
3. 提供角色 CRUD、菜单/按钮权限勾选、角色关联管理员和授权审计。
4. 保留 Server 端最终鉴权，前端权限只负责路由提示和按钮可见性。

## 2. 范围与非目标

### 本次范围

- `RbacModule` 后端模块及管理员接口。
- 共享权限目录和权限码同步。
- Admin RBAC 页面、角色编辑权限树、菜单目录和按钮级权限组件。
- 角色与管理员关联维护。
- 权限替换事务、系统角色保护和审计日志。

### 非目标

- 不允许后台新增、编辑或删除菜单定义；菜单定义随代码发布。
- 不在本次引入资源级或数据级权限。
- 不改变现有登录、Token 和验证码流程。
- 不把 API 权限作为普通管理员可自由勾选的界面配置项。

## 3. 核心架构

### 3.1 模块职责

认证与授权分层：

- `AuthModule`：登录、短信/图形验证码、Access Token、Refresh Token、当前会话和通用认证守卫。
- `RbacModule`：角色、权限目录、角色授权、用户角色关联和授权审计。
- `PermissionGuard`：继续作为通用守卫，由 `AuthModule` 提供；它从数据库读取当前用户有效权限并校验控制器声明。

`RbacModule` 内部保持深模块接口：

- `RbacService`：统一完成权限目录校验、UI 权限到 API 权限的闭包展开和角色授权事务。
- `RoleService`：角色查询、创建、更新、删除/停用以及关联管理员。
- `PermissionCatalogService`：读取共享权限目录并同步 `Permission` 表。
- `AdminRbacController`：只负责 DTO 校验、权限声明和调用服务。

### 3.2 共享权限目录

新增 `packages/shared-types/src/rbac/permission-catalog.ts`，目录中的每个定义包含：

- `code`：稳定的权限码，格式沿用 `module.action`。
- `type`：`menu`、`button` 或 `api`。
- `label`：展示名称。
- `module`：业务模块。
- `path`：菜单对应的 Admin 路由路径，API 权限可为空。
- `parentCode`：按钮所属菜单权限码。
- `order`：同级菜单或按钮排序。
- `icon`：Admin 图标注册表中的稳定 key。
- `impliedApiCodes`：选择某个菜单/按钮时由 Server 自动补齐的 API 权限。

目录约束：

- 权限码唯一，路由路径唯一。
- `parentCode` 必须引用已存在的菜单权限。
- 按钮必须拥有菜单父级；API 不允许作为菜单父级。
- `impliedApiCodes` 只能引用目录中的 API 权限。
- 目录不包含运行时状态，数据库只保存角色和权限关联。

Admin 使用同一目录，再由 `apps/admin/src/routes/registry.ts` 绑定 lazy route loader、页面元素和路由级 `PermissionRoute`。因此新增后台页面时只需新增目录定义和路由绑定，不需要再维护 Sidebar 数组。

### 3.3 API 权限闭包

角色编辑界面只提交 `menu` 和 `button` 权限码。Server 保存时执行：

1. 校验所有提交码存在于共享目录且类型为 `menu` 或 `button`。
2. 保留提交的 UI 权限码。
3. 沿 `impliedApiCodes` 展开 API 权限闭包。
4. 在一个事务内替换 `RolePermission`，确保不存在半套授权。

API 权限仍可由 `@RequirePermissions` 在控制器上声明；Server 通过共享常量避免拼写漂移。前端不会显示 API 勾选框，但角色实际权限集合包含自动补齐的 API 码。

## 4. 后端接口

所有接口统一使用 `AccessTokenGuard + PermissionGuard`，返回共享类型和统一响应包装。

| 方法   | 路径                                | 作用                                       | 所需权限               |
| ------ | ----------------------------------- | ------------------------------------------ | ---------------------- |
| GET    | `/admin/rbac/catalog`               | 获取代码生成的菜单/按钮目录和只读 API 目录 | `rbac.permission.read` |
| GET    | `/admin/rbac/roles`                 | 分页查询角色                               | `rbac.view`            |
| GET    | `/admin/rbac/roles/:id`             | 查询角色详情和已授权权限                   | `rbac.view`            |
| POST   | `/admin/rbac/roles`                 | 创建普通角色                               | `rbac.role.create`     |
| PATCH  | `/admin/rbac/roles/:id`             | 更新名称、说明和启用状态                   | `rbac.role.update`     |
| DELETE | `/admin/rbac/roles/:id`             | 删除未关联管理员的普通角色                 | `rbac.role.delete`     |
| PUT    | `/admin/rbac/roles/:id/permissions` | 原子替换菜单/按钮权限                      | `rbac.role.update`     |
| GET    | `/admin/rbac/roles/:id/users`       | 查询角色关联管理员                         | `rbac.assign_role`     |
| PUT    | `/admin/rbac/roles/:id/users`       | 替换角色关联管理员                         | `rbac.assign_role`     |

角色分页响应固定为 `list`、`total`、`page`、`pageSize`。角色摘要包含管理员数量、权限数量、系统角色标识和启用状态。

业务保护规则：

- `super_admin` 等 `isSystem=true` 角色不可删除、停用或清空权限。
- 普通角色有关联管理员时不能删除，只能停用或先解除关联。
- 角色名唯一，更新时返回明确的冲突错误。
- 角色权限替换、角色关联替换和角色状态修改均写入 `PermissionAuditLog`。
- 审计记录包含操作人、操作类型、目标 ID、变更摘要和请求 IP。

## 5. Admin 页面与按钮权限

页面目录遵循项目约定：

- `apps/admin/src/pages/Rbac/index.tsx`：角色列表和只读菜单目录标签页。
- `apps/admin/src/pages/Rbac/Edit.tsx`：角色基本信息、菜单/按钮权限树和保存操作。
- `apps/admin/src/pages/Rbac/Detail.tsx`：角色详情、已授权权限和关联管理员。
- `apps/admin/src/api/rbac/`：按权限域集中管理 API 调用和共享类型。

新增权限能力：

- `usePermission(code)`：判断当前用户是否拥有权限。
- `usePermissions()`：提供 `hasAll`、`hasAny` 和权限集合。
- `PermissionGate`：包装按钮或操作区域，默认无权限时隐藏，也可选择显示禁用态。
- `PermissionRoute`：从路由注册表读取所需权限，缺少权限时展示统一 403 提示。

Sidebar 从路由注册表过滤 `menu` 权限，不再维护独立菜单数组。角色编辑树展示菜单和按钮两种节点：菜单节点显示路径和图标，按钮节点显示动作名称，API 权限仅作为只读信息显示。父级支持全选、取消和半选；按钮权限仍可独立勾选。

Server 是最终权限边界，前端隐藏按钮不能替代服务端校验。所有现有 Admin 控制器将逐步从仅 `AdminGuard` 迁移到对应的权限码声明，保持接口行为不变。

## 6. 数据与初始化

不新增数据库表，复用现有 RBAC 表。将 `seed-initial-data.ts` 中的权限数组改为从共享目录导入并 upsert，保留已有权限码兼容。初始化流程：

1. `prisma db push` 同步现有 schema。
2. `prisma:seed` 同步权限目录、默认 `super_admin` 角色、默认管理员和默认系统设置。
3. `super_admin` 获得目录中的全部 menu、button 和 API 权限。

不生成 Prisma migration；项目当前仍处于初始建表阶段，开发数据库按现有约定使用 `db push`。

## 7. 测试与验收

### 共享包

- 权限码唯一、路由路径唯一。
- 菜单父子关系完整，按钮父级和 API 隐含引用有效。
- 目录类型与展示字段符合约束。

### Server

- `PermissionCatalogService` 同步和闭包展开。
- 角色创建、更新、停用、删除和冲突错误。
- 系统角色保护及有关联管理员时的删除保护。
- 权限替换和用户角色替换的事务性及审计日志。
- 所有 RBAC Controller 的权限元数据和 401/403 行为。
- API 权限越权拒绝，以及按钮权限自动补齐 API 权限。

### Admin

- 路由注册表生成 Sidebar 和路由守卫。
- `PermissionGate` 的隐藏、禁用、`all` 和 `any` 行为。
- 角色列表分页、角色编辑、权限树半选、保存成功和冲突失败。
- 菜单目录只读且不出现新增/编辑/删除入口。
- 系统角色只读和未授权用户的 403 页面。

### 最终质量门禁

通过项目已有的格式检查、Lint、类型检查、单元测试、Server E2E、Admin E2E 和三端生产构建。验收场景：新增一条路由权限定义并构建后，该菜单/按钮自动出现在目录与角色编辑树；未授权用户看不到对应按钮，直接调用 API 会得到 403。

## 8. 取舍说明

- 选择共享权限目录而不是数据库菜单配置，保证代码路由与授权策略同版本发布，避免运行时漂移。
- 选择 `RbacModule` 而不是 `PermissionModule` 或 `AuthorizationModule`：当前模块明确覆盖角色、权限、用户角色关系和审计，同时避免与已有 `AuthModule` 产生命名重复。
- API 权限保留在 Server 端自动展开和校验，避免把内部接口细节暴露为普通后台配置项。
