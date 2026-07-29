# 前端目录与 API 契约规范

## 1. 前后端共享契约

- 请求参数、响应数据、分页结构和业务枚举统一定义在
  `packages/shared-types/src/api/`。
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
└── users.ts
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

## 4. 注释要求

- 共享类型、接口和字段必须使用 JSDoc 描述业务含义。
- 联合类型或常量对象中的每个业务值必须分别说明适用状态。
- 导出的 API 函数、公共服务方法和含业务转换的辅助函数必须说明用途。
- 不为显而易见的赋值、JSX 结构或语法重复添加无信息量注释。
