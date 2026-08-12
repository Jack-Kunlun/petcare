# 前端目录与 API 契约规范

## 1. 前后端共享契约

- 请求参数、响应数据、分页结构和业务枚举统一定义在
  `packages/shared-types/src/api/`。
- ~~Admin、Taro Miniapp 和 Server 必须从 `@petcare/shared-types` 导入契约。~~
- Admin、Miniapp 和 Server 必须从 `@petcare/shared-types` 导入契约，禁止在应用内重复声明同名接口。
- Server 的 DTO 负责运行时校验和 Swagger 元数据，并通过 `implements` 对齐共享请求契约。
- 时间在 HTTP 契约中统一使用 ISO 8601 字符串；数据库实体中的 `Date` 由响应序列化层转换。
- 新增或修改字段时先更新共享契约，再同步服务端 DTO、业务实现和客户端调用。

## 2. API 文件组织

Admin 的所有 HTTP 调用统一放在 `apps/admin/src/api/`：

```text
src/api/
├── api-response.ts
├── auth.ts
├── orders.ts
├── users.ts
└── content/
    ├── index.ts
    ├── rewards.ts
    ├── posts.ts
    └── articles.ts
```

- 按业务域拆分文件，不建立包含所有接口的超大单文件。
- `api/` 只负责客户端配置、请求发送和响应解包，不放页面状态或展示逻辑。
- 页面、组件和认证状态层不得直接创建 Axios 实例。
- 每个导出的 API 函数必须说明用途，并显式使用共享请求和响应类型。

## 3. 页面目录组织

页面必须使用“模块目录 + 页面文件”的结构：

```text
src/pages/
└── UserManagement/
    ├── index.tsx
    ├── Edit.tsx
    ├── Detail.tsx
    └── index.test.tsx
```

- 模块目录使用 PascalCase，并与页面组件名称一致。
- 模块默认页面固定为 `index.tsx`。
- 编辑页固定为 `Edit.tsx`，详情页固定为 `Detail.tsx`。
- 页面测试与页面同目录；默认页面测试命名为 `index.test.tsx`。
- API 文件不得放入页面目录。

内容管理页面使用 `ContentManagement/index.tsx` 作为悬赏默认页，`ContentManagement/Posts/index.tsx` 和 `ContentManagement/Articles/index.tsx` 分别承载帖子与课堂文章列表；对应请求统一放在 `apps/admin/src/api/content/`，不得在页面内直接创建 Axios 请求。

## 4. 注释要求

- 共享类型、接口和字段必须使用 JSDoc 描述业务含义。
- 联合类型或常量对象中的每个业务值必须分别说明适用状态。
- 导出的 API 函数、公共服务方法和含业务转换的辅助函数必须说明用途。
- 不为显而易见的赋值、JSX 结构或语法重复添加无信息量注释。

## 5. 系统设置模块示例

系统设置使用共享契约、领域 API 目录和页面模块三层结构：

```text
packages/shared-types/src/api/system-settings.ts
apps/admin/src/api/system-settings/
├── client.ts
├── overview.ts
├── sop.ts
├── rating-threshold.ts
└── fee.ts
apps/admin/src/pages/Settings/
├── index.tsx
├── Edit.tsx
├── Detail.tsx
├── SopEditor.tsx
├── RatingThresholdEditor.tsx
└── FeeEditor.tsx
```

- 页面只通过 `apps/admin/src/api/system-settings/` 访问 `/admin/system-settings`，所有请求和响应类型从 `@petcare/shared-types` 导入。
- 页面级当前配置、草稿和最近发布历史分别维护加载、失败和重试状态；某个查询失败不得遮蔽其他已成功区域。
- 保存冲突、领域校验失败等分支按 `SYSTEM_CONFIG_*` 稳定错误码处理，不以中文消息文本作为程序判断条件。
- 评分输入在界面显示小数分、费率显示百分比、金额显示元，但提交前分别转换为整数百分值、万分比和分；禁止在 HTTP 契约中传浮点业务值。
- 输入校验错误必须通过稳定 `id` 与 `aria-describedby` 关联到对应控件；异步错误使用可聚焦或可感知的 `role="alert"`，并提供明确的重试入口。
- 系统设置路由使用 `React.lazy` 分包加载，并由 `Suspense` 提供可感知的加载状态，避免将低频管理页面打入 Admin 首屏主包。
- 发布前必须展示结构化差异并要求二次确认；恢复历史版本只生成草稿，不得在界面文案中暗示已立即生效。

## 6. RBAC 前端契约与授权边界

- 权限目录的唯一来源是 `@petcare/shared-types` 的 `RBAC_PERMISSION_CATALOG`。Admin 不维护第二份菜单、按钮或 API 权限常量；`GET /admin/rbac/catalog` 仅提供目录版本和服务端目录的只读展示数据。
- Admin 路由必须集中登记在 `apps/admin/src/routes/registry.ts`。每个可见菜单路由都要引用目录中的 `menuPermission`；详情、编辑等非菜单路由同样必须声明 `requiredPermissions`，启动时校验这些权限码存在于共享目录。
- `/rbac`、`/rbac/new`、`/rbac/:id/edit` 与 `/rbac/:id` 只通过 `apps/admin/src/api/rbac/` 访问 `/admin/rbac/*`。请求与响应类型从 `@petcare/shared-types` 导入，不在页面内重复声明。
- 角色编辑器展示 `menu`、`button` 和 `api` 类型权限；`api` 节点仅作为只读信息显示并禁用勾选，不纳入提交 payload。服务端根据共享目录的 `impliedApiCodes` 自动补齐有效 API 权限。
- 页面级入口、编辑、删除、分配管理员和发布等操作必须使用 `PermissionGate`，并与路由的 `PermissionRoute` 配合，避免向无权限会话展示不可执行的操作。`PermissionGate` 可改善界面和可访问性，但绝不替代 Server 的 `PermissionGuard`：所有 `/admin/rbac/*` 及其他受保护 API 仍必须在服务端逐请求重新授权。
