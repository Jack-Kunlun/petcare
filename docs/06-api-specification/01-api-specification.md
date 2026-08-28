# PetCare API 接口规范

本文档定义PetCare平台的RESTful API设计规范，确保前后端协作的一致性和可维护性。

> **当前范围说明（2026-08-27）**：个人版当前运行时只注册认证、健康检查、账户/用户、本人宠物档案、课堂与受控社区、
> RBAC、Admin 账户和官网内容模块。本文后续保留的服务者认证、订单、服务履约、评价、投诉纠纷和系统费用/SOP
> 设置接口属于历史或未来商业设计，不是当前可调用 API。是否可用必须以 `apps/server/src/app.module.ts` 的默认装配、
> 当前路由测试和[开发路线图](../01-requirements/05-development-roadmap.md)为准，不能仅根据接口表推断。

## 📋 目录

- [设计原则](#设计原则)
- [基础规范](#基础规范)
- [认证授权](#认证授权)
- [官网内容模块](#官网内容模块)
- [请求规范](#请求规范)
- [响应规范](#响应规范)
- [错误处理](#错误处理)
- [分页规范](#分页规范)
- [版本管理](#版本管理)
- [速率限制](#速率限制)
- [API列表](#api列表)

---

## 设计原则

### RESTful 风格

1. **资源命名**：使用名词复数形式
   - ✅ `/users` - 用户列表
   - ❌ `/getUsers` - 动词开头

2. **HTTP方法语义**：
   - `GET` - 查询资源
   - `POST` - 创建资源
   - `PUT` - 全量更新资源
   - `PATCH` - 部分更新资源
   - `DELETE` - 删除资源

3. **层级关系**：使用嵌套路径表示从属关系
   - `/users/{id}/orders` - 用户的订单列表

### 一致性

- 当前 Server 路由不带版本前缀；版本化将在出现不兼容协议时统一引入
- 统一的响应格式
- 统一的错误码体系
- 统一的日期时间格式（ISO 8601）

### 向后兼容

- API版本号包含在URL中
- 不删除已有字段，仅标记为deprecated
- 新增字段不影响旧客户端

---

## 基础规范

### Base URL

```
Server 直连: http://localhost:3000
Admin 开发代理: http://localhost:8986/api（代理到 Server，并移除 /api）
生产环境: https://api.petcare.com
```

### Content-Type

- **请求**: `application/json`
- **响应**: `application/json`

### 字符编码

- UTF-8

### 日期时间格式

遵循 ISO 8601 标准：

```json
{
  "createdAt": "2026-07-16T10:00:00.000Z",
  "updatedAt": "2026-07-16T10:30:00.000Z"
}
```

---

## 认证授权

### JWT Token 认证

#### 获取Token

**请求**：

```http
POST /auth/login/password
Content-Type: application/json

{
  "identifier": "admin",
  "password": "your-admin-password"
}
```

**响应**：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "phone": "13800138000",
      "nickname": "系统管理员",
      "roles": ["super_admin"]
    }
  },
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-22T14:00:00.000Z"
  }
}
```

刷新令牌只写入 `HttpOnly` Cookie，不出现在 JSON 响应体中。

#### Token 刷新

**请求**：

```http
POST /auth/refresh
Cookie: petcare_refresh_token=<refresh-token>
```

刷新成功后服务端轮换 Cookie，并返回与登录接口相同的 `data` 结构。

### 小程序微信认证

小程序认证使用独立的 `/auth/wechat/*` 接口。Access Token 通过 Bearer 请求头传递，
Refresh Token 通过 JSON 正文传递，不使用后台管理的 Cookie。

#### 微信登录

```http
POST /auth/wechat/login
Content-Type: application/json

~~旧客户端调用来源：`Taro.login`~~

{
  "loginCode": "<uni.login 返回的 code>"
}
```

已绑定用户直接返回完整会话：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "status": "authenticated",
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "user": {
      "id": "uuid",
      "phone": "13800138000",
      "nickname": "宠友1878",
      "avatar": null,
      "userType": "pet_owner"
    }
  },
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-28T00:00:00.000Z"
  }
}
```

首次登录返回短时绑定挑战，不创建用户：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "status": "phone_required",
    "bindToken": "<300 秒内有效的一次性令牌>"
  },
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-28T00:00:00.000Z"
  }
}
```

客户端不得提交或伪造 `openid`；Server 只接受微信接口交换得到的身份。

#### 绑定授权手机号

```http
POST /auth/wechat/bind-phone
Content-Type: application/json

{
  "bindToken": "<微信登录返回值>",
  "phoneCode": "<getPhoneNumber 返回的 code>"
}
```

成功返回 `status=authenticated` 的完整会话。手机号已有账号且尚未绑定微信时，只补充
`openid`，保留原账号资料和角色；身份冲突返回 409。

#### 刷新、退出和当前用户

```http
POST /auth/wechat/refresh
Content-Type: application/json

{ "refreshToken": "<refresh-token>" }
```

刷新成功会使旧 Refresh Token 立即失效并返回新的完整会话。

```http
POST /auth/wechat/logout
Content-Type: application/json

{ "refreshToken": "<refresh-token>" }
```

退出成功返回 204，无响应正文。

```http
GET /auth/wechat/me
Authorization: Bearer <access-token>
```

`/me` 返回小程序用户安全字段，不要求管理员角色。

#### 小程序认证错误码

| 错误码                       | HTTP | 说明                         |
| ---------------------------- | ---- | ---------------------------- |
| `AUTH_WECHAT_LOGIN_FAILED`   | 401  | 微信登录凭证无效             |
| `WECHAT_SERVICE_UNAVAILABLE` | 503  | 微信服务或服务端配置不可用   |
| `AUTH_PHONE_AUTH_FAILED`     | 400  | 微信手机号授权失败           |
| `AUTH_BIND_TOKEN_EXPIRED`    | 401  | 手机号绑定挑战过期或已消费   |
| `AUTH_ACCOUNT_CONFLICT`      | 409  | 微信身份与手机号账号冲突     |
| `AUTH_ACCOUNT_DISABLED`      | 403  | 用户账号被停用               |
| `AUTH_SESSION_EXPIRED`       | 401  | Access 或 Refresh 会话已失效 |

### 请求头认证

所有需要认证的接口必须在请求头携带Token：

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### RBAC 角色权限

| 角色               | 说明       | 权限范围       |
| ------------------ | ---------- | -------------- |
| `SUPER_ADMIN`      | 超级管理员 | 所有权限       |
| `ADMIN`            | 普通管理员 | 后台管理权限   |
| `SERVICE_PROVIDER` | 服务提供者 | 接单、管理SOP  |
| `USER`             | 普通用户   | C端功能        |
| `GUEST`            | 访客       | 仅浏览公开信息 |

---

## 后台 RBAC 管理模块 (`/admin/rbac`)

所有 RBAC 路由都要求有效的管理员 Bearer Token；实际授权由 Server 的 `PermissionGuard` 和权限目录中的 API 权限执行，前端隐藏入口不构成授权。

| 方法     | 路径                                | 所需权限               | 用途                                                            |
| -------- | ----------------------------------- | ---------------------- | --------------------------------------------------------------- |
| `GET`    | `/admin/rbac/catalog`               | `rbac.permission.read` | 读取服务端定义的只读权限目录和目录版本。                        |
| `GET`    | `/admin/rbac/roles`                 | `rbac.view`            | 分页查询角色；支持 `page`、`pageSize`、`roleName`、`isActive`。 |
| `GET`    | `/admin/rbac/roles/:id`             | `rbac.view`            | 读取角色详情、有效权限码和关联管理员 ID。                       |
| `POST`   | `/admin/rbac/roles`                 | `rbac.role.create`     | 创建非系统角色。                                                |
| `PATCH`  | `/admin/rbac/roles/:id`             | `rbac.role.update`     | 更新非系统角色的名称、说明或启用状态。                          |
| `DELETE` | `/admin/rbac/roles/:id`             | `rbac.role.delete`     | 删除未关联管理员的非系统角色。                                  |
| `PUT`    | `/admin/rbac/roles/:id/permissions` | `rbac.role.update`     | 原子替换角色的可分配菜单、按钮权限。                            |
| `GET`    | `/admin/rbac/roles/:id/users`       | `rbac.assign_role`     | 读取关联管理员。                                                |
| `PUT`    | `/admin/rbac/roles/:id/users`       | `rbac.assign_role`     | 原子替换关联管理员。                                            |

`POST /roles` 请求体为 `{ "roleName": string, "description"?: string }`；更新请求允许 `roleName`、`description`、`isActive` 的部分字段。权限替换请求为 `{ "permissionCodes": string[] }`，只能提交目录中 `menu` 或 `button` 类型的码；Server 会补齐其 `impliedApiCodes`，API 类型权限不可由客户端直接赋值。用户替换请求为 `{ "userIds": string[] }`。

角色列表统一返回 `{ list, total, page, pageSize }`，角色详情返回 `id`、`roleName`、`description`、`isSystem`、`isActive`、`permissionCount`、`userCount`、`updatedAt`、`permissionCodes` 与 `userIds`。系统角色不可修改或删除；冲突、受保护角色、已关联用户、未知用户和未同步权限分别通过稳定错误码及标准错误 envelope 返回。

权限目录的唯一来源是 `@petcare/shared-types` 中的 `RBAC_PERMISSION_CATALOG`。目录响应 `{ version, permissions }` 用于前端展示和缓存失效，但不允许将其当作可写的菜单配置；数据库权限记录由 seed 与目录同步，服务端始终依据当前目录和实时角色授权判定。

---

## 后台内容管理模块 (`/admin/content`)

内容管理是 Admin 的独立一级菜单，包含悬赏管理、帖子管理和课堂文章管理三个二级页面。所有接口要求有效的管理员 Bearer Token，并由 Server 的 `PermissionGuard` 校验内容域 API 权限。

| 方法  | 路径                      | 所需权限               | 说明                                                                                                           |
| ----- | ------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET` | `/admin/content/rewards`  | `content.reward.read`  | 分页查询悬赏订单；服务端固定 `orderType=reward`，支持 `page`、`pageSize`、`keyword`、`serviceType`、`status`。 |
| `GET` | `/admin/content/posts`    | `content.post.read`    | 分页查询社区帖子；支持 `page`、`pageSize`、`keyword`、`status`。正文只返回列表摘要。                           |
| `GET` | `/admin/content/articles` | `content.article.read` | 分页查询课堂文章；支持 `page`、`pageSize`、`keyword`、`status`。                                               |

三个接口均返回统一分页结构：`{ list, total, page, pageSize }`。悬赏金额以元返回，时间字段使用 ISO 8601 字符串。内容菜单权限由 `@petcare/shared-types` 的 `RBAC_PERMISSION_CATALOG` 唯一声明：`content.view` 对应 `/content` 默认悬赏页，`content.post.view` 对应 `/content/posts`，`content.article.view` 对应 `/content/articles`。

---

## 官网内容模块

模块使用 `/admin/website-content`、`/website-content` 与 `/content` 三组路径。Admin 接口要求管理员 Bearer Token，并由官网内容权限码控制。公开接口无需登录，只返回已发布版本；预览接口必须携带有效的 `X-Website-Preview-Token`。

| 方法   | 路径                                                    | 所需权限/认证            | 用途                                 |
| ------ | ------------------------------------------------------- | ------------------------ | ------------------------------------ |
| `GET`  | `/admin/website-content`                                | `website.read`           | 读取官网内容总览。                   |
| `GET`  | `/admin/website-content/:contentKey/draft`              | `website.read`           | 读取当前草稿。                       |
| `PUT`  | `/admin/website-content/:contentKey/draft`              | `website.edit_action`    | 保存新的不可变草稿版本。             |
| `GET`  | `/admin/website-content/:contentKey/diff`               | `website.read`           | 比较草稿与当前发布版本。             |
| `GET`  | `/admin/website-content/:contentKey/history`            | `website.read`           | 读取版本历史。                       |
| `GET`  | `/admin/website-content/:contentKey/history/:versionId` | `website.read`           | 读取指定历史版本。                   |
| `POST` | `/admin/website-content/:contentKey/previews`           | `website.edit_action`    | 创建短期预览令牌。                   |
| `POST` | `/admin/website-content/:contentKey/publish`            | `website.publish_action` | 显式发布当前草稿。                   |
| `POST` | `/admin/website-content/:contentKey/restore`            | `website.edit_action`    | 将历史版本恢复为新草稿，不自动发布。 |
| `GET`  | `/admin/website-content/media-assets`                   | `website.read`           | 查询受管理的官网素材。               |
| `POST` | `/admin/website-content/media-assets`                   | `website.edit_action`    | 创建素材记录并签发上传信息。         |
| `POST` | `/admin/website-content/media-assets/:assetId/archive`  | `website.edit_action`    | 归档素材。                           |
| `GET`  | `/website-content/:contentKey`                          | 公开                     | 读取指定页面或站点外壳的已发布内容。 |
| `GET`  | `/website-content/previews/:contentKey`                 | 预览令牌                 | 读取预览令牌绑定的内容版本。         |
| `GET`  | `/content/articles`                                     | 公开                     | 读取已发布课堂文章列表。             |
| `GET`  | `/content/articles/:slug`                               | 公开                     | 按 slug 读取已发布课堂文章详情。     |

当前 Admin 只编辑已注册的预设区块，区块数据仍使用带 `sectionType` 与 `schemaVersion` 的共享契约保存，后续新增、删除和排序能力无需改变页面版本模型。发布是独立动作；保存草稿、恢复历史版本和创建预览均不会改变线上内容。素材内容只保存服务端生成的对象标识和公开 URL，不保存或下发任何存储 provider 凭据。

---

## 请求规范

### 请求头

```http
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: uuid (可选，用于追踪)
Accept-Language: zh-CN (可选)
```

### 查询参数

用于过滤、排序、分页：

```
GET /orders?status=PENDING&page=1&pageSize=20&sortBy=createdAt&order=DESC
```

**常用参数**：

- `page` - 页码（从1开始）
- `pageSize` - 每页数量（默认20，最大100）
- `sortBy` - 排序字段
- `order` - 排序方向（ASC/DESC）
- `keyword` - 搜索关键词

### 请求体

#### 创建资源

```json
POST /orders
{
  "petId": "uuid",
  "serviceTypeId": "uuid",
  "scheduledTime": "2026-07-20T14:00:00.000Z",
  "address": {
    "province": "广东省",
    "city": "深圳市",
    "district": "南山区",
    "detail": "科技园南路xxx号"
  },
  "remark": "请准时到达"
}
```

#### 更新资源

**全量更新 (PUT)**：

```json
PUT /orders/{id}
{
  "status": "CONFIRMED",
  "assignedProviderId": "uuid",
  "scheduledTime": "2026-07-20T15:00:00.000Z"
}
```

**部分更新 (PATCH)**：

```json
PATCH /orders/{id}
{
  "status": "IN_PROGRESS"
}
```

### 文件上传

当前没有已实现的通用 `POST /uploads/images` 或 `/uploads/documents` 服务。本节历史描述不构成可调用接口；
当前唯一已交付的文件上传能力是下文 `/admin/account/avatar` 的管理员公开头像替换接口。

---

## 响应规范

除下文列出的例外外，所有 JSON 接口都返回同一种 envelope。业务数据始终位于 `data`，客户端不应在页面或业务服务中重复解析 envelope。

### 成功响应

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "status": "ok"
  },
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-22T14:00:00.000Z"
  }
}
```

- `code`：稳定的业务码。成功固定为 `SUCCESS`，不得使用 HTTP 状态码代替。
- `message`：适合直接展示的简短中文消息。
- `data`：当前接口的领域数据；无业务数据时为 `null`。
- `meta.requestId`：请求追踪 ID。
- `meta.timestamp`：服务端生成响应的 ISO 8601 时间。

### 请求追踪

客户端可通过 `X-Request-Id` 请求头传入仅包含字母、数字、点、下划线、冒号或连字符的追踪 ID，最长 128 个字符。值无效或未提供时，Server 自动生成 UUID。

每个 JSON 响应同时满足：

```text
响应头 X-Request-Id === 响应体 meta.requestId
```

排查日志或向后端反馈问题时，应同时提供该值。

### HTTP 状态码

业务码和 HTTP 状态各司其职：`code` 供客户端稳定判断业务原因，HTTP 状态供代理、监控和通用 HTTP 客户端判断请求结果。错误响应不会统一改为 HTTP 200。

| 状态码 | 说明                  | 当前约定                     |
| ------ | --------------------- | ---------------------------- |
| 200    | OK                    | 查询、登录或普通操作成功     |
| 201    | Created               | 注册、创建订单等资源创建成功 |
| 204    | No Content            | 操作成功且明确没有响应体     |
| 400    | Bad Request           | DTO 或业务输入校验失败       |
| 401    | Unauthorized          | 凭据错误或登录状态失效       |
| 403    | Forbidden             | 已认证但没有所需权限         |
| 404    | Not Found             | 用户、订单等资源不存在       |
| 429    | Too Many Requests     | 验证码等操作触发频率限制     |
| 500    | Internal Server Error | 未知服务端异常               |

---

## 错误处理

### 错误响应格式

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "用户不存在",
  "data": null,
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-22T14:00:00.000Z"
  }
}
```

- 错误响应的 `data` 固定为 `null`。
- `message` 只包含可安全展示的信息；未知异常的内部消息和堆栈不会返回给客户端。
- 参数校验错误会合并为安全消息，不回显密码、令牌或服务端实现细节。

### 业务错误码

业务错误码使用大写蛇形命名，并按领域添加前缀。已有客户端可以依赖下列稳定值：

| code                       | HTTP | 说明                       |
| -------------------------- | ---- | -------------------------- |
| `VALIDATION_FAILED`        | 400  | 请求参数校验失败           |
| `AUTH_INVALID_CAPTCHA`     | 400  | 图形验证码错误或已过期     |
| `AUTH_INVALID_CREDENTIALS` | 401  | 账号、密码或短信凭据错误   |
| `AUTH_SESSION_EXPIRED`     | 401  | 登录状态缺失、失效或已过期 |
| `FORBIDDEN`                | 403  | 当前身份无权执行操作       |
| `RESOURCE_NOT_FOUND`       | 404  | 请求的资源不存在           |
| `RATE_LIMIT_EXCEEDED`      | 429  | 请求频率超过限制           |
| `INTERNAL_SERVER_ERROR`    | 500  | 已脱敏的未知服务端异常     |

新增错误码时必须保持含义单一；不得复用同一个业务码表达无关原因，也不得把数据库或第三方 SDK 的原始错误字符串作为 `code`。

### 全局异常处理

Server 使用成功响应拦截器与全局异常过滤器在 HTTP 边界统一组装 envelope：

```typescript
throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
```

Controller 和 Service 只返回领域数据或抛出异常，不得手工再包一层 `{ code, message, data, meta }`。

### 不包装的响应

以下响应保持原始 HTTP 语义，不生成 JSON envelope：

- HTTP 204 响应；
- 下载文件、图片、二进制流等原始响应；
- Server-Sent Events 或其他持续流；
- 明确接管原生 `Response` 的控制器方法。

使用 `@Res({ passthrough: true })` 仅设置 Cookie 或响应头的接口仍会包装返回值，例如登录与刷新接口。

### 客户端解包

- Admin 在 Axios 响应拦截器中统一把 `response.data` 替换为 envelope 的 `data`。
- `@petcare/api-client` 执行同样的中央解包，并将错误转换为带 `code`、`requestId` 和 HTTP `status` 的 `ApiClientError`。
- 页面、Store 与 endpoint 方法只消费领域数据，不得再次读取 `.data.data`。
- Miniapp 当前没有网络调用点；后续接入时应复用共享 Client 或实现等价的单一边界适配。
- Website 的服务端请求统一由 `apps/website/src/lib/api.ts` 解包；公开页面不得直接访问 Admin 接口。

### 公共字段安全

用户、管理员和订单关联用户仅返回显式白名单字段。公共响应与 Swagger schema 永远不得包含 `passwordHash`、刷新令牌、角色关联内部记录或其他未声明关系。新增字段必须同时更新 Prisma `select`、响应 DTO、Swagger 文档和测试。

---

## 分页规范

所有分页接口统一使用 `page` 和 `pageSize` 请求参数，分页业务数据固定放在统一响应的 `data` 中。不得使用 `items`、`orders` 等领域化列表字段，也不得由客户端进行字段重命名。

**请求**：

```
GET /orders?page=1&pageSize=20
```

**响应**：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-22T14:00:00.000Z"
  }
}
```

- `list`：当前页数据，没有记录时返回空数组。
- `total`：符合查询条件的记录总数。
- `page`：当前页码，从 1 开始。
- `pageSize`：每页记录数。

---

## 版本管理

### 当前策略

当前实现使用 `/users`、`/orders`、`/auth` 等无版本前缀路由。只有在必须引入不兼容变更时，才新增 `/v2/...` 路由；不得在没有兼容性需求时同时维护多套空壳版本。

### 版本策略

- 已发布字段只新增、不改变既有含义。
- 不兼容变更通过新 URL 版本提供，并给旧版本设置明确废弃期。
- 废弃版本至少保留 6 个月，并在响应头与文档中同步公告。

### 版本协商

未来如采用媒体类型版本协商，可使用：

```http
Accept: application/vnd.petcare.v1+json
```

---

## 速率限制

### 限流策略

| 端点类型 | 限制       | 时间窗口 |
| -------- | ---------- | -------- |
| 认证接口 | 10次/分钟  | 滑动窗口 |
| 普通接口 | 100次/分钟 | 滑动窗口 |
| 文件上传 | 5次/分钟   | 固定窗口 |

### 限流响应

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "请求频率超限，请稍后重试",
  "data": null,
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-22T14:00:00.000Z"
  }
}
```

**响应头**：

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1626400800
Retry-After: 30
```

---

## API 列表

### 认证模块 (/auth)

| 方法 | 路径                   | 说明                 | 权限 |
| ---- | ---------------------- | -------------------- | ---- |
| POST | `/auth/login/password` | 管理员密码登录       | 公开 |
| POST | `/auth/login/sms`      | 管理员短信验证码登录 | 公开 |
| POST | `/auth/wechat/login`   | 小程序微信登录       | 公开 |
| POST | `/auth/refresh`        | 刷新管理员会话       | 公开 |
| POST | `/auth/logout`         | 退出管理员会话       | 公开 |
| GET  | `/auth/me`             | 获取当前管理员资料   | 认证 |

个人版不提供通用公开注册端点。小程序首次微信登录会按受控的微信身份创建账户；绑定手机号必须在有效会话中完成。

### 用户模块 (/users)

| 方法 | 路径                          | 说明                 | 权限        |
| ---- | ----------------------------- | -------------------- | ----------- |
| GET  | `/admin/users`                | 后台用户列表         | `user.read` |
| GET  | `/users/{id}`                 | 公开用户资料         | 公开        |
| GET  | `/users/me`                   | 当前小程序用户资料   | 小程序会话  |
| PUT  | `/users/me`                   | 更新当前用户资料     | 小程序会话  |
| POST | `/users/me/avatar`            | 替换当前用户头像     | 小程序会话  |
| POST | `/users/me/phone/code`        | 发送手机号绑定验证码 | 小程序会话  |
| PUT  | `/users/me/phone`             | 验证并绑定手机号     | 小程序会话  |
| POST | `/users/me/cancellation/code` | 发送账户注销验证码   | 小程序会话  |
| POST | `/users/me/cancel`            | 注销当前账户         | 小程序会话  |

`GET /admin/users` 支持 `page`、`pageSize`、`keyword`、`userType` 和 `status`
查询参数，分页数据统一返回 `list`、`total`、`page`、`pageSize`。

`GET /users/{id}` 的成功响应 `data` 是裸公开用户对象，仅包含 `id`、`nickname`、`avatar`、
`userType`、固定值 `active` 的 `status`，以及可空的 `profile`。`profile` 仅包含 `region` 和
`bio`；在具备可信的粗粒度地区数据源前，`region` 固定返回 `null`。完整手机号、账号、存储地址、
后台角色和创建或更新时间均不公开。不存在、停用和封禁账户统一返回 `RESOURCE_NOT_FOUND`，避免泄露账户状态。

### 管理员个人中心模块 (`/admin/account`)

以下接口要求有效 Bearer Access Token，且调用者当前至少保有一个活跃的后台角色；不要求额外的业务权限码。所有
JSON 成功响应均使用本文的统一 envelope，`204 No Content` 接口不返回响应体。

| 方法   | 路径                      | 说明                 | 成功响应 |
| ------ | ------------------------- | -------------------- | -------- |
| GET    | `/admin/account/profile`  | 获取当前管理员资料   | 200      |
| PATCH  | `/admin/account/profile`  | 仅更新当前管理员昵称 | 200      |
| PUT    | `/admin/account/avatar`   | 替换当前管理员头像   | 200      |
| DELETE | `/admin/account/avatar`   | 删除当前管理员头像   | 204      |
| PUT    | `/admin/account/password` | 修改当前管理员密码   | 204      |

#### `GET /admin/account/profile`

成功时 `data` 仅包含安全资料：

```json
{
  "id": "8bf4e1f5-2b85-49a9-ae7b-5f8193ccf7b4",
  "username": "admin",
  "maskedPhone": "138****8000",
  "nickname": "值班管理员",
  "avatar": "https://cdn.example.com/public/admin-avatars/.../avatar.webp",
  "status": "active",
  "roles": ["operator"],
  "createdAt": "2026-08-12T00:00:00.000Z"
}
```

`maskedPhone` 只在原号码为 11 位数字时显示前三位、四个星号和后四位；任何非标准存量号码均返回 `"****"`。
完整手机号、密码或密码哈希、COS 对象键和 `sessionVersion` 均不会出现在资料响应中。

#### `PATCH /admin/account/profile`

请求体仅允许昵称，长度为 1–30 个字符：

```json
{ "nickname": "值班管理员" }
```

服务端会去除首尾空白，并拒绝空值及控制字符。成功返回 `200` 的标准 envelope，`data` 为最新完整
`AdminAccountProfile`（字段与 `GET /admin/account/profile` 相同）。昵称与头像可独立更新；Admin 成功更新后会立即刷新
Header 中显示的资料。

#### `PUT /admin/account/avatar` 与 `DELETE /admin/account/avatar`

替换接口使用 `multipart/form-data`，文件字段名为 `file`。仅接受服务器按文件字节和声明 MIME 类型共同确认的
JPEG、PNG 或 WebP，文件最大 2 MiB；成功响应为：

```json
{ "avatar": "https://cdn.example.com/public/admin-avatars/.../new-avatar.png" }
```

上传先写入新对象，再以可串行化事务切换数据库中的当前头像，随后尽力清理旧对象；失败或并发冲突不会让新的未关联对象
成为活跃头像。`DELETE` 清空当前头像并返回 `204 No Content`。媒体 provider 被禁用或运行中的存储服务不可用时，
资料和密码接口仍可用，但上传返回 `503 STORAGE_UNAVAILABLE`；选择 COS 后凭据不完整会使 Server 在启动前失败。

#### `PUT /admin/account/password`

请求体：

```json
{
  "currentPassword": "current-password",
  "newPassword": "replacement-password-at-least-12"
}
```

`newPassword` 至少 12 个字符。成功返回 `204 No Content`，服务端以乐观版本检查更新密码并递增账户
`sessionVersion`，使该账户所有 Admin 和 Miniapp 的既有 Access/Refresh Token 失效；同时按当前 Access Token 的
`sid` 撤销本次 Redis 会话，并清除路径限定为 `/api/auth` 的 Refresh Cookie。

| HTTP 状态 | 错误码                             | 适用场景                                       |
| --------- | ---------------------------------- | ---------------------------------------------- |
| 400       | `VALIDATION_FAILED`                | 昵称、密码请求体或头像格式无效                 |
| 409       | `ACCOUNT_PASSWORD_NOT_CONFIGURED`  | 当前账户未设置密码                             |
| 401       | `ACCOUNT_CURRENT_PASSWORD_INVALID` | 当前密码错误                                   |
| 400       | `ACCOUNT_PASSWORD_REUSED`          | 新密码与当前密码相同                           |
| 400       | `AVATAR_INVALID_TYPE`              | 非 JPEG、PNG 或 WebP，或 MIME 与文件字节不一致 |
| 401       | `AUTH_SESSION_EXPIRED`             | Access Token 无效、过期或账户会话版本已失效    |
| 403       | `FORBIDDEN`                        | 当前用户没有活跃后台角色                       |
| 409       | `ACCOUNT_CONCURRENT_UPDATE`        | 密码或头像被并发更新                           |
| 413       | `AVATAR_FILE_TOO_LARGE`            | 文件超过 2 MiB                                 |
| 503       | `STORAGE_UNAVAILABLE`              | 媒体 provider 未启用或存储服务不可用           |

### 宠托师认证审核模块 (/admin/provider-certifications)

| 方法 | 路径                                          | 说明             | 权限  |
| ---- | --------------------------------------------- | ---------------- | ----- |
| GET  | `/admin/provider-certifications`              | 认证申请分页列表 | ADMIN |
| GET  | `/admin/provider-certifications/{id}`         | 认证申请详情     | ADMIN |
| POST | `/admin/provider-certifications/{id}/approve` | 通过认证申请     | ADMIN |
| POST | `/admin/provider-certifications/{id}/reject`  | 驳回认证申请     | ADMIN |

列表接口支持 `page`、`pageSize`、`keyword` 和 `status`。`status` 可取
`pending`、`approved`、`rejected`，默认将待审核申请排在最前。分页响应统一返回
`list`、`total`、`page`、`pageSize`。

驳回请求正文为 `{ "reason": "驳回原因" }`，原因去除首尾空白后长度必须为
2–500 个字符。只有 `pending` 申请可以审核；申请已经被其他管理员处理时返回
HTTP 409 和错误码 `REVIEW_CONFLICT`。

审核通过与 Provider 当前认证状态在同一数据库事务中更新。审核管理员从 Access
Token 获取，客户端不得传入。接口只返回脱敏姓名、脱敏身份证号码和审核必需的证明
材料地址，不返回身份证号码原文、密码、Token 或其他未声明的敏感字段。

### 宠物模块 (/pets)

| 方法   | 路径                                | 说明             | 权限 |
| ------ | ----------------------------------- | ---------------- | ---- |
| GET    | `/pets`                             | 我的宠物列表     | 认证 |
| POST   | `/pets`                             | 添加宠物         | 认证 |
| GET    | `/pets/{id}`                        | 宠物详情         | 本人 |
| PUT    | `/pets/{id}`                        | 更新宠物信息     | 本人 |
| DELETE | `/pets/{id}`                        | 删除宠物         | 本人 |
| POST   | `/pets/{id}/media-assets`           | 上传并绑定宠物图 | 本人 |
| DELETE | `/pets/{id}/media-assets/{assetId}` | 删除宠物图片     | 本人 |

所有接口均从 Access Token 获取当前用户，客户端不得传入或修改 `ownerId`。详情、更新和删除只查询当前用户拥有的宠物；记录不存在与跨用户访问统一返回 HTTP 404 和 `PET_NOT_FOUND`，避免泄露其他用户的宠物是否存在。

`POST /pets` 与 `PUT /pets/{id}` 使用完整字段请求体；`PUT` 会整体替换可编辑字段：

```json
{
  "name": "团团",
  "species": "dog",
  "breed": "中华田园犬",
  "gender": "female",
  "birthDate": "2023-05-01",
  "weightKg": 12.4,
  "sterilized": true,
  "notes": "不能吃巧克力"
}
```

`species` 可取 `cat`、`dog`、`rabbit`、`hamster`、`bird`、`other`；`gender` 可取 `male`、`female`、`unknown`。`birthDate` 为 `YYYY-MM-DD` 或 `null`，`weightKg` 为 0.1–200 且最多两位小数，或为 `null`。单个用户最多创建 5 个宠物档案，并发创建通过用户行锁串行化。

列表返回 `id`、`name`、`species`、`breed`、`gender`、`birthDate` 和 `coverImage`。详情额外返回 `weightKg`、`sterilized`、`notes`、`photoUrls`、`photoAssets`、`createdAt` 和 `updatedAt`。`photoAssets` 为本人可见的受管理图片元数据，包含 `id`、`url`、服务端检测的 `mimeType`、`width`、`height` 和 `sizeBytes`；照护备注、完整照片列表和媒体标识均不进入公开宠物摘要。兼容保留的旧 `age` 字段不通过 API 暴露。

`POST /pets/{id}/media-assets` 使用 `multipart/form-data` 的 `file` 字段。图片类型只接受服务端从字节检测出的 JPEG、PNG 或 WebP，大小为 1 字节到 10 MiB，宽高均为 32–8192 像素；客户端声明的扩展名和 MIME 类型不作为信任来源。每个宠物最多保留 5 张图片，数量会在上传前和所有者行锁事务内重复检查。`photoUrls` 与 `photoAssets` 不是创建或更新宠物档案的请求字段。

上传对象使用独立的 `public/pet-media/` 存储前缀，并在同一数据库事务中登记所有者、宠物、对象键、校验和、真实类型、大小和尺寸，再写入兼容的 `photos` URL 投影。数据库登记失败会补偿删除已上传对象。删除单图或整个宠物时先在事务内解除引用并记录清理状态，再尝试删除对象；对象存储暂时不可用不会让已删除图片重新出现在宠物响应中。

图片删除和宠物删除成功均返回 `204 No Content`。宠物被订单引用时仍拒绝删除；不存在、跨用户或跨宠物的媒体标识不会返回其他所有者信息。

| HTTP 状态 | 错误码                          | 适用场景                        |
| --------- | ------------------------------- | ------------------------------- |
| 400       | `VALIDATION_FAILED`             | 请求字段、日期或数值范围无效    |
| 401       | `AUTH_SESSION_EXPIRED`          | Access Token 无效、过期或已失效 |
| 403       | `AUTH_ACCOUNT_DISABLED`         | 写入期间发现当前账户已停用      |
| 404       | `PET_NOT_FOUND`                 | 记录不存在或不属于当前用户      |
| 409       | `PET_LIMIT_REACHED`             | 当前用户已有 5 个宠物档案       |
| 409       | `PET_REFERENCED_BY_ORDER`       | 宠物仍被订单引用，不能删除      |
| 400       | `PET_PHOTO_INVALID`             | 图片缺失、损坏、类型或尺寸无效  |
| 404       | `PET_PHOTO_NOT_FOUND`           | 图片不存在或不属于本人的该宠物  |
| 409       | `PET_PHOTO_LIMIT_REACHED`       | 宠物已有 5 张图片               |
| 413       | `PET_PHOTO_INVALID`             | multipart 文件超过 10 MiB       |
| 503       | `PET_PHOTO_STORAGE_UNAVAILABLE` | 对象存储暂时无法接受上传        |

### 订单模块 (/orders)

| 方法  | 路径                    | 说明               | 权限           |
| ----- | ----------------------- | ------------------ | -------------- |
| GET   | `/admin/orders`         | 后台订单列表       | ADMIN          |
| GET   | `/orders`               | 可浏览待接悬赏列表 | 公开           |
| POST  | `/orders/reward`        | 创建悬赏订单       | 认证且资料完善 |
| GET   | `/orders/{id}`          | 可浏览待接悬赏详情 | 公开           |
| PUT   | `/orders/{id}`          | 更新订单           | 相关方         |
| PATCH | `/orders/{id}/cancel`   | 取消订单           | 用户           |
| PATCH | `/orders/{id}/confirm`  | 确认接单           | PROVIDER       |
| PATCH | `/orders/{id}/complete` | 完成订单           | PROVIDER       |

`GET /admin/orders` 支持 `page`、`pageSize`、`keyword`、`orderType`、
`serviceType` 和 `status` 查询参数，分页数据统一返回 `list`、`total`、`page`、
`pageSize`。

### 服务模块 (/services)

| 方法 | 路径                  | 说明           | 权限  |
| ---- | --------------------- | -------------- | ----- |
| GET  | `/services/types`     | 服务类型列表   | 公开  |
| POST | `/services/types`     | 创建服务类型   | ADMIN |
| GET  | `/services/providers` | 服务提供者列表 | 公开  |
| GET  | `/services/sops`      | SOP模板列表    | ADMIN |
| POST | `/services/sops`      | 创建SOP模板    | ADMIN |

### 评价模块 (/reviews)

| 方法 | 路径                             | 说明           | 权限   |
| ---- | -------------------------------- | -------------- | ------ |
| POST | `/reviews`                       | 创建评价       | USER   |
| GET  | `/reviews/{orderId}`             | 订单评价       | 相关方 |
| GET  | `/reviews/provider/{providerId}` | 提供者评价列表 | 公开   |

### 通知模块 (/notifications)

| 方法   | 路径                       | 说明         | 权限 |
| ------ | -------------------------- | ------------ | ---- |
| GET    | `/notifications`           | 通知列表     | 认证 |
| PATCH  | `/notifications/{id}/read` | 标记已读     | 本人 |
| PATCH  | `/notifications/read-all`  | 全部标记已读 | 本人 |
| DELETE | `/notifications/{id}`      | 删除通知     | 本人 |

### 文件上传

通用 `/uploads` 模块尚未实现，不能将历史接口表中的 `/uploads/images` 或 `/uploads/documents` 视为可用。
管理员头像上传的实际接口、格式限制和错误码见“管理员个人中心模块 (`/admin/account`)”。

---

## 投诉纠纷模块 (`/complaints`、`/admin/complaints`)

投诉属于订单管理子域。完整处理链路为：创建投诉 → 被投诉方首次回应 → 管理员初审 → 双方二次申诉 → 管理员终审。所有接口均使用 Bearer Access Token；用户端接口仅允许订单当事方访问，后台接口要求任意有效角色拥有 `dispute.resolve` 权限，或访问者具有 `super_admin` 角色。默认管理员角色具备 `dispute.resolve` 权限，但接口不依赖固定角色名称。

### 用户端接口

| 方法 | 路径                             | 说明                                        | 权限       |
| ---- | -------------------------------- | ------------------------------------------- | ---------- |
| POST | `/complaints`                    | 为本人参与的订单创建投诉                    | 订单当事方 |
| GET  | `/complaints?page=1&pageSize=20` | 查询当前用户参与的投诉                      | 订单当事方 |
| GET  | `/complaints/{id}`               | 查询投诉详情及服务端计算的 `allowedActions` | 订单当事方 |
| POST | `/complaints/{id}/respond`       | 被投诉方提交唯一一次首次回应                | 被投诉方   |
| POST | `/complaints/{id}/appeals`       | 初审后提交唯一一次二次申诉                  | 投诉任一方 |
| POST | `/complaints/{id}/withdraw`      | 初审前撤回投诉                              | 投诉方     |

创建投诉请求字段：

| 字段               | 类型     | 含义                                         |
| ------------------ | -------- | -------------------------------------------- |
| `orderId`          | UUID     | 被投诉订单唯一标识；当前用户必须是订单当事方 |
| `complaintType`    | string   | 投诉业务类型                                 |
| `reason`           | string   | 投诉原因                                     |
| `evidenceUrls`     | string[] | 投诉方证据文件地址；无证据时传空数组         |
| `expectedSolution` | string   | 投诉方期望处理方案                           |

首次回应和二次申诉共用请求字段：`statement` 为本次陈述，`evidenceUrls` 为本次新增证据地址，`version` 为详情响应中的并发版本。二次申诉必须提供相对于既有材料的新理由，或至少一个新的证据 URL；同一方只能提交一次。撤回请求只包含 `version`。

用户详情包含投诉与订单当事方标识、投诉原因和证据、首次回应、初审/终审、完整陈述 `statements`、状态审计时间线 `events`、`secondAppealDeadline`、服务端计算的 `allowedActions`、并发 `version` 以及创建/更新时间。客户端不得复制服务端状态转换规则，只能依据 `status` 和 `allowedActions` 渲染操作入口。

### Admin 接口

| 方法 | 路径                                                         | 说明                                               | 权限                                             |
| ---- | ------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------ |
| GET  | `/admin/complaints`                                          | 按工作队列分页查询投诉                             | `dispute.resolve` / `super_admin`                |
| GET  | `/admin/complaints/{id}`                                     | 查询案件卷宗详情                                   | `dispute.resolve` / `super_admin`                |
| POST | `/admin/complaints/{id}/claim`                               | 原子认领未分配案件                                 | `dispute.resolve` / `super_admin`                |
| POST | `/admin/complaints/{id}/transfer`                            | 转交案件给其他有效管理员                           | 当前处理人且有 `dispute.resolve` / `super_admin` |
| POST | `/admin/complaints/{id}/decisions/initial`                   | 提交初审并开启二次申诉窗口                         | 当前处理人且有 `dispute.resolve` / `super_admin` |
| POST | `/admin/complaints/{id}/decisions/final`                     | 申诉窗口到期后提交终审、关闭案件并替换初审执行任务 | 当前处理人且有 `dispute.resolve` / `super_admin` |
| GET  | `/admin/complaints/{id}/execution-tasks?page=1&pageSize=100` | 查询该案件的内部裁决执行任务                       | `dispute.resolve` / `super_admin`                |
| POST | `/admin/complaints/{id}/execution-tasks/{taskId}/retry`      | 重试该案件下失败的执行任务                         | `dispute.resolve` / `super_admin`                |

管理员不得认领、转交或裁决自己作为订单当事方的案件。拥有 `dispute.resolve` 权限的普通管理员只有在成为当前处理人后才可裁决；`super_admin` 可处理任意非本人利益冲突案件。

后台列表参数：

| 字段        | 类型    | 含义                             |
| ----------- | ------- | -------------------------------- |
| `page`      | integer | 页码，从 1 开始                  |
| `pageSize`  | integer | 每页条数                         |
| `queue`     | string  | 工作队列，见下表，默认 `mine`    |
| `status`    | string? | 可选的七状态筛选                 |
| `keyword`   | string? | 可选的案件号、订单号或用户关键词 |
| `handlerId` | UUID?   | 可选的处理管理员筛选             |

工作队列值为：`mine`（我的未结案件）、`unassigned`（待认领）、`pending_response`（待首次回应）、`processing_initial`（待初审）、`initial_decided`（申诉期）、`processing_final`（待终审）、`execution_failed`（执行失败）、`closed`（已关闭或已撤回）。

认领请求为 `{ "version": 1 }`；转交请求为 `{ "targetAdminId": "uuid", "reason": "转交原因", "version": 1 }`。初审和终审请求字段如下：

| 字段                     | 类型    | 含义                                                             |
| ------------------------ | ------- | ---------------------------------------------------------------- |
| `liability`              | string  | `complainant`、`respondent`、`shared` 或 `insufficient_evidence` |
| `reason`                 | string  | 去除首尾空白后 10～1000 字符的裁决理由                           |
| `refundAmount`           | integer | 退还投诉方的金额，单位为分，必须大于等于 0                       |
| `settlementAmount`       | integer | 结算给服务方的金额，单位为分，必须大于等于 0                     |
| `complainantCreditDelta` | integer | 投诉方信用分调整，范围 -100～100                                 |
| `respondentCreditDelta`  | integer | 被投诉方信用分调整，范围 -100～100                               |
| `version`                | integer | 详情响应中的乐观并发版本                                         |

退款额与结算额之和不得超过订单可分配金额 `order.allocatableAmount`。投诉、纠纷和受影响订单中的全部金额均为整数分，不使用浮点金额。

### 共享响应字段

以下均为统一成功响应 `data` 内的领域对象。公共用户响应只公开订单当事方完成投诉流程所需的信息；后台响应才包含双方手机号、处理人和订单运营摘要。金额字段均为整数分。

#### 用户投诉列表项 `ComplaintListItem`

| 字段               | 类型             | 含义                                                                        |
| ------------------ | ---------------- | --------------------------------------------------------------------------- |
| `id`               | UUID             | 投诉唯一标识                                                                |
| `caseNumber`       | string           | 可稳定展示和检索的案件编号                                                  |
| `orderId`          | UUID             | 关联订单唯一标识                                                            |
| `complaintType`    | string           | 投诉业务类型                                                                |
| `status`           | ComplaintStatus  | 当前七状态之一                                                              |
| `counterpart`      | object           | 相对当前访问者的另一方安全摘要，仅含 `id`、`nickname`、`avatar`，不含手机号 |
| `appealDeadlineAt` | ISO 8601 \| null | 二次申诉截止时刻；不在申诉阶段时为 `null`                                   |
| `createdAt`        | ISO 8601         | 投诉创建时间                                                                |
| `updatedAt`        | ISO 8601         | 投诉最后更新时间                                                            |

#### 后台投诉列表项 `AdminComplaintListItem`

| 字段                 | 类型             | 含义                                                            |
| -------------------- | ---------------- | --------------------------------------------------------------- |
| `id`                 | UUID             | 投诉唯一标识                                                    |
| `caseNumber`         | string           | 后台展示和检索使用的案件编号                                    |
| `orderId`            | UUID             | 关联订单唯一标识                                                |
| `complaintType`      | string           | 投诉业务类型                                                    |
| `complainantId`      | UUID             | 投诉方唯一标识                                                  |
| `complainant`        | object           | 投诉方后台摘要，含 `id`、`nickname`、`phone`                    |
| `respondentId`       | UUID             | 被投诉方唯一标识                                                |
| `respondent`         | object           | 被投诉方后台摘要，含 `id`、`nickname`、`phone`                  |
| `status`             | ComplaintStatus  | 当前七状态之一                                                  |
| `handlerId`          | UUID \| null     | 当前处理管理员标识；未认领时为 `null`                           |
| `handler`            | object \| null   | 当前处理人摘要，含 `id`、`nickname`、`phone`；未认领时为 `null` |
| `appealDeadlineAt`   | ISO 8601 \| null | 二次申诉截止时刻                                                |
| `hasFailedExecution` | boolean          | 是否存在需人工关注的失败裁决执行任务                            |
| `createdAt`          | ISO 8601         | 投诉创建时间                                                    |
| `updatedAt`          | ISO 8601         | 投诉最后更新时间                                                |

#### 用户投诉详情 `ComplaintDetail`

| 字段                     | 类型              | 含义                                                           |
| ------------------------ | ----------------- | -------------------------------------------------------------- |
| `id`                     | UUID              | 投诉唯一标识                                                   |
| `orderId`                | UUID              | 关联订单唯一标识                                               |
| `complainantId`          | UUID              | 投诉方唯一标识                                                 |
| `respondentId`           | UUID              | 被投诉方唯一标识                                               |
| `complaintType`          | string            | 投诉业务类型                                                   |
| `expectedSolution`       | string \| null    | 投诉方期望处理方案                                             |
| `status`                 | ComplaintStatus   | 当前七状态之一                                                 |
| `reason`                 | string            | 原始投诉理由                                                   |
| `evidenceUrls`           | string[]          | 原始投诉证据地址                                               |
| `respondentStatement`    | string \| null    | 被投诉方首次回应；未回应时为 `null`                            |
| `respondentEvidenceUrls` | string[]          | 被投诉方首次回应证据地址                                       |
| `handlerId`              | UUID \| null      | 当前处理管理员标识；用户端不返回管理员手机号                   |
| `initialDecision`        | Decision \| null  | 初审内容；未初审时为 `null`                                    |
| `finalDecision`          | Decision \| null  | 终审内容；未终审时为 `null`                                    |
| `statements`             | Statement[]       | 各阶段陈述，按提交时间排列                                     |
| `events`                 | Event[]           | 状态和操作审计时间线，按发生时间排列                           |
| `secondAppealDeadline`   | ISO 8601 \| null  | 当前二次申诉截止时刻                                           |
| `allowedActions`         | ComplaintAction[] | 服务端按访问者、状态和期限计算的可执行动作；客户端不得自行推导 |
| `version`                | integer           | 写操作使用的乐观并发版本                                       |
| `createdAt`              | ISO 8601          | 投诉创建时间                                                   |
| `updatedAt`              | ISO 8601          | 投诉最后更新时间                                               |

详情中的嵌套对象字段如下：

| 对象字段                          | 类型                    | 含义                                                |
| --------------------------------- | ----------------------- | --------------------------------------------------- |
| `Decision.liability`              | string                  | 责任划分结果                                        |
| `Decision.reason`                 | string                  | 裁决理由                                            |
| `Decision.refundAmount`           | integer                 | 退还投诉方的整数分金额                              |
| `Decision.settlementAmount`       | integer                 | 结算给服务方的整数分金额                            |
| `Decision.complainantCreditDelta` | integer                 | 投诉方信用分调整                                    |
| `Decision.respondentCreditDelta`  | integer                 | 被投诉方信用分调整                                  |
| `Decision.version`                | integer                 | 返回详情时的当前乐观并发版本，与详情 `version` 一致 |
| `Statement.id`                    | UUID                    | 陈述记录唯一标识                                    |
| `Statement.stage`                 | string                  | 陈述阶段，如首次材料、首次回应或二次申诉            |
| `Statement.authorId`              | UUID                    | 陈述提交人唯一标识                                  |
| `Statement.statement`             | string                  | 陈述正文                                            |
| `Statement.evidenceUrls`          | string[]                | 本次陈述附带的证据地址                              |
| `Statement.createdAt`             | ISO 8601                | 陈述提交时间                                        |
| `Event.id`                        | UUID                    | 审计事件唯一标识                                    |
| `Event.actorId`                   | UUID \| null            | 操作人标识；系统事件为 `null`                       |
| `Event.action`                    | string                  | 触发事件的业务动作                                  |
| `Event.fromStatus`                | ComplaintStatus \| null | 动作前状态；创建事件可为 `null`                     |
| `Event.toStatus`                  | ComplaintStatus \| null | 动作后状态；无状态变更时可为 `null`                 |
| `Event.payload`                   | string \| null          | JSON 字符串扩展数据；无扩展数据时为 `null`          |
| `Event.createdAt`                 | ISO 8601                | 事件发生时间                                        |

#### 后台投诉详情 `AdminComplaintDetail`

后台详情包含 `ComplaintDetail` 的全部字段，并增加：

| 字段          | 类型           | 含义                                                                                                   |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `caseNumber`  | string         | 后台展示和检索使用的案件编号                                                                           |
| `order`       | object         | 订单运营摘要，含 `id`、`orderType`、`serviceType`、整数分 `allocatableAmount`、`status`、`serviceTime` |
| `complainant` | object         | 投诉方后台摘要，含 `id`、`nickname`、`phone`                                                           |
| `respondent`  | object         | 被投诉方后台摘要，含 `id`、`nickname`、`phone`                                                         |
| `handler`     | object \| null | 当前处理人后台摘要，含 `id`、`nickname`、`phone`；未认领时为 `null`                                    |

#### 裁决执行任务 `DisputeExecutionTaskView`

| 字段            | 类型             | 含义                                                                |
| --------------- | ---------------- | ------------------------------------------------------------------- |
| `id`            | UUID             | 执行任务唯一标识                                                    |
| `complaintId`   | UUID             | 所属投诉唯一标识                                                    |
| `decisionLevel` | string           | 来源裁决层级：`initial` 或 `final`                                  |
| `taskType`      | string           | `refund`、`settlement`、`complainant_credit` 或 `respondent_credit` |
| `status`        | string           | `pending`、`processing`、`succeeded`、`failed` 或 `superseded`      |
| `failureReason` | string \| null   | 最近一次失败的安全摘要；未失败时为 `null`                           |
| `retryCount`    | integer          | 已执行的重试次数                                                    |
| `nextRetryAt`   | ISO 8601 \| null | 失败任务的下次自动重试时间；无需重试时为 `null`                     |
| `completedAt`   | ISO 8601 \| null | 成功完成或被取代的时间；尚未完成时为 `null`                         |
| `createdAt`     | ISO 8601         | 任务创建时间                                                        |
| `updatedAt`     | ISO 8601         | 任务最后更新时间                                                    |

### 分页响应

用户投诉列表、后台投诉列表和执行任务列表的 `data` 都严格使用以下四个字段，不得使用 `items` 或领域化别名：

```json
{
  "list": [],
  "total": 0,
  "page": 1,
  "pageSize": 20
}
```

`list` 是当前页记录，`total` 是符合筛选条件的总数，`page` 是从 1 开始的当前页，`pageSize` 是每页条数。

### 投诉状态与 72 小时边界

| 状态                 | 含义                                           |
| -------------------- | ---------------------------------------------- |
| `pending_response`   | 等待被投诉方首次回应                           |
| `unassigned`         | 已回应或回应期限已到，等待管理员认领           |
| `processing_initial` | 已认领，等待初审                               |
| `initial_decided`    | 初审完成，处于二次申诉窗口                     |
| `processing_final`   | 至少一方已提交二次申诉，等待申诉窗口结束后终审 |
| `closed`             | 终审结案，或无人申诉时按初审结果自动结案       |
| `withdrawn`          | 投诉方在初审前撤回                             |

初审成功时服务端写入 `secondAppealDeadline = 初审时间 + 72 小时`。投诉双方各有一次二次申诉机会；在截止时间之前提交有效，达到或超过截止时刻后拒绝并返回 `APPEAL_DEADLINE_EXPIRED`。任一方申诉后案件进入 `processing_final`，另一方在原 72 小时截止时间前仍可提交其唯一一次申诉；管理员在窗口到期前不能终审。窗口到期时，无人申诉的案件由服务端把不可变初审结果作为生效结果并自动关闭；存在申诉的案件允许当前处理人或无利益冲突的超级管理员终审。终审后关闭案件，不再允许申诉。

所有状态变更、认领、转交、陈述、裁决及执行任务结果均写入案件时间线/审计事件。写操作必须携带最新 `version`；并发版本不一致时返回状态冲突，客户端应重新获取详情，不得自行推断下一状态。

### 业务错误码

| code                           | HTTP | 含义                                                  |
| ------------------------------ | ---- | ----------------------------------------------------- |
| `COMPLAINT_STATE_CONFLICT`     | 409  | 当前状态或并发版本已变化，操作不能应用                |
| `COMPLAINT_ACTION_NOT_ALLOWED` | 409  | 当前身份、案件关系或状态不允许该操作                  |
| `APPEAL_DEADLINE_EXPIRED`      | 409  | 二次申诉已达到或超过 72 小时截止时间                  |
| `OPEN_COMPLAINT_EXISTS`        | 409  | 同一订单已存在未关闭且未撤回的投诉                    |
| `DECISION_AMOUNT_INVALID`      | 400  | 裁决金额不是整数分、为负数或合计超过订单可分配金额    |
| `EXECUTION_TASK_NOT_RETRYABLE` | 409  | 执行任务不属于当前投诉或当前状态不是可重试的 `failed` |

### 内部裁决执行任务

初审和终审都会为非零退款计划、服务方结算计划及双方信用分调整创建内部幂等任务。无人申诉时，窗口到期后执行初审任务并自动结案；存在二次申诉时，终审会把未执行的初审任务标记为 `superseded`，再执行终审任务。任务类型为 `refund`、`settlement`、`complainant_credit`、`respondent_credit`；状态为 `pending`、`processing`、`succeeded`、`failed`、`superseded`。每个裁决副作用使用唯一幂等键，重复消费或人工重试不会重复记账或重复调整信用分。

本版本的退款与结算任务仅记录和执行项目内部账务副作用，**不会调用微信支付**。微信支付退款或转账接入属于后续版本，接入前不得把内部任务成功解释为第三方资金已到账。

## 后台系统设置模块 (`/admin/system-settings`)

系统设置按固定领域键管理版本：SOP 使用 `sop:feeding`、`sop:walking`、`sop:playing`，评分阈值使用 `rating_threshold`，费用使用 `fee`。所有接口均要求管理员访问令牌。

### 接口与权限

| 方法 | 路径                                             | 用途                                       | 权限                                         |
| ---- | ------------------------------------------------ | ------------------------------------------ | -------------------------------------------- |
| GET  | `/overview`                                      | 查询所有领域的当前版本和草稿摘要           | `system.view`                                |
| GET  | `/sop/:serviceType/{current,draft,diff,history}` | 查询 SOP 当前版本、草稿、差异或分页历史    | `system.view`                                |
| GET  | `/sop/:serviceType/history/:versionId`           | 查询单个 SOP 历史版本                      | `system.view`                                |
| PUT  | `/sop/:serviceType/draft`                        | 保存 SOP 草稿                              | `system.sop_config`                          |
| POST | `/sop/:serviceType/{publish,restore}`            | 发布 SOP 或恢复历史版本为草稿              | `system.sop_config` + `system.publish`       |
| GET  | `/rating-threshold/{current,draft,diff,history}` | 查询评分阈值当前版本、草稿、差异或分页历史 | `system.view`                                |
| GET  | `/rating-threshold/history/:versionId`           | 查询单个评分阈值历史版本                   | `system.view`                                |
| PUT  | `/rating-threshold/draft`                        | 保存评分阈值草稿                           | `system.threshold_config`                    |
| POST | `/rating-threshold/{publish,restore}`            | 发布评分阈值或恢复历史版本为草稿           | `system.threshold_config` + `system.publish` |
| GET  | `/fee/{current,draft,diff,history}`              | 查询费用当前版本、草稿、差异或分页历史     | `system.view`                                |
| GET  | `/fee/history/:versionId`                        | 查询单个费用历史版本                       | `system.view`                                |
| PUT  | `/fee/draft`                                     | 保存费用草稿                               | `system.fee_config`                          |
| POST | `/fee/{publish,restore}`                         | 发布费用或恢复历史版本为草稿               | `system.fee_config` + `system.publish`       |

`serviceType` 仅允许 `feeding`、`walking`、`playing`。历史查询使用 `page` 和 `pageSize`；历史记录发布后不可修改。

### 写入契约与整数单位

- 保存草稿请求固定为 `{ revision, config, changeSummary }`，服务端以 `revision` 实施乐观锁并在成功后递增。
- 发布请求固定为 `{ revision, idempotencyKey }`；同一领域重复提交同一键返回第一次成功结果，不会生成第二个历史版本。
- 恢复请求固定为 `{ version, revision, changeSummary }`。恢复只建立新草稿，仍需再次发布才能生效。
- 评分使用整数百分值，例如 `350` 表示 `3.50` 分；比例使用整数万分比，例如 `1000` 表示 `10%`；金额使用整数分。
- SOP 违规规则是人工处置建议，不直接产生扣款、信用扣分或暂停账号等副作用。

### 稳定错误码

| HTTP 状态 | 错误码                             | 含义                                   |
| --------- | ---------------------------------- | -------------------------------------- |
| 400       | `SYSTEM_CONFIG_VALIDATION_FAILED`  | 配置未通过领域完整性校验               |
| 404       | `SYSTEM_CONFIG_NOT_FOUND`          | 当前配置、草稿或指定历史版本不存在     |
| 409       | `SYSTEM_CONFIG_VERSION_CONFLICT`   | 提交的草稿修订号已过期，或并发写入冲突 |
| 500       | `SYSTEM_CONFIG_PERSISTENCE_FAILED` | 领域配置持久化失败                     |

未登录和权限不足分别使用通用 `401`、`403` 响应。客户端必须按稳定错误码处理冲突与校验失败，不依赖中文错误文案。

### 订单快照约束

订单创建时读取当前已发布配置，并冻结 `sopConfigVersionId`、`feeConfigVersionId`、`order_sops` 和 `order_fee_snapshots`。发布或恢复新版本只影响之后创建的订单，既有订单始终沿用创建时的版本和快照。

评分阈值当前仅提供版本化配置能力。后续实现服务者接单命令时，命令处理器必须显式调用评分资格门禁并读取当前已发布阈值，不能假设配置发布会自动拦截接单。

---

## DTO 示例

### 用户DTO

```typescript
// packages/shared-types/src/user.dto.ts

export interface CreateUserDto {
  phone: string;
  password: string;
  name?: string;
  avatar?: string;
}

export interface UserResponseDto {
  id: string;
  phone: string;
  name: string;
  avatar?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  SERVICE_PROVIDER = "SERVICE_PROVIDER",
  USER = "USER",
  GUEST = "GUEST",
}
```

### 订单DTO

```typescript
// packages/shared-types/src/order.dto.ts

export interface CreateOrderDto {
  petId: string;
  serviceTypeId: string;
  scheduledTime: string;
  address: AddressDto;
  remark?: string;
}

export interface OrderResponseDto {
  id: string;
  orderNo: string;
  userId: string;
  providerId?: string;
  petId: string;
  serviceTypeId: string;
  status: OrderStatus;
  scheduledTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  address: AddressDto;
  amount: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export enum OrderStatus {
  PENDING = "PENDING", // 待接单
  CONFIRMED = "CONFIRMED", // 已确认
  IN_PROGRESS = "IN_PROGRESS", // 进行中
  COMPLETED = "COMPLETED", // 已完成
  CANCELLED = "CANCELLED", // 已取消
  REFUNDED = "REFUNDED", // 已退款
}
```

---

## Swagger 集成

### 装饰器示例

```typescript
// apps/server/src/modules/user/user.controller.ts

@ApiTags("users")
@Controller("users")
export class UserController {
  @Get(":id")
  @ApiOperation({ summary: "获取用户详情" })
  @ApiParam({ name: "id", description: "用户ID" })
  @ApiSuccessResponse(UserResponseDto)
  @ApiStandardErrors(404, 500)
  findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }
}
```

`ApiSuccessResponse` 将具体领域 DTO 放入统一 envelope 的 `data` schema；`ApiStandardErrors` 注册标准错误 envelope。新增 JSON 路由时两者必须同时使用，204 路由使用 `ApiNoContentResponse`。

### 访问Swagger UI

- **开发环境**: http://localhost:3000/api-docs
- **生产环境**: 已禁用

---

## 最佳实践

### 1. 幂等性

对于可能重复提交的接口（如创建订单），使用幂等键：

```http
POST /orders
Idempotency-Key: unique-request-id-123
```

### 2. 部分字段返回

使用 `fields` 参数指定返回字段：

```
GET /users?fields=id,name,avatar
```

### 3. 条件请求

使用 ETag 进行缓存优化：

```http
GET /users/123
If-None-Match: "etag-value"

// 如果资源未修改，返回 304 Not Modified
```

### 4. 批量操作

提供批量操作接口减少请求次数：

```http
POST /users/batch
{
  "operations": [
    { "method": "CREATE", "data": {...} },
    { "method": "UPDATE", "id": "uuid", "data": {...} }
  ]
}
```

### 5. Webhook 回调

对于异步操作，提供Webhook回调：

```json
POST /orders
{
  "callbackUrl": "https://yourdomain.com/webhook/order-status",
  "callbackEvents": ["CONFIRMED", "COMPLETED"]
}
```

---

## 附录

### 项目内相关文档

- [技术架构](../03-technical-architecture/01-tech-stack.md) - 后端技术栈说明
- [开发规范](../09-development-guidelines/02-development-standards.md) - Nest.js开发规范
- [环境变量配置](../environment-variables.md) - API服务配置项
- [部署指南](../08-deployment/deployment.md) - API服务部署说明

### 外部参考

- [Nest.js 官方文档](https://docs.nestjs.com/)
- [OpenAPI 规范](https://swagger.io/specification/)
- [RFC 7231 - HTTP/1.1](https://tools.ietf.org/html/rfc7231)
- [JWT 规范](https://jwt.io/)

### 工具推荐

- **API测试**: Postman / Apifox
- **Mock服务**: Mockoon
- **API文档生成**: Swagger Codegen
- **接口监控**: Apifox Monitor

---

**最后更新**: 2026-08-27
**维护者**: PetCare 后端团队  
**版本**: v1.0
