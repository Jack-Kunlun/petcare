# PetCare API 接口规范

本文档定义PetCare平台的RESTful API设计规范，确保前后端协作的一致性和可维护性。

## 📋 目录

- [设计原则](#设计原则)
- [基础规范](#基础规范)
- [认证授权](#认证授权)
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
      "phone": "17679141878",
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

使用 `multipart/form-data`：

```http
POST /uploads/images
Content-Type: multipart/form-data

file: (binary)
```

**响应**：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "url": "https://oss.petcare.com/images/xxx.jpg",
    "thumbnailUrl": "https://oss.petcare.com/images/xxx_thumb.jpg",
    "size": 1024000,
    "mimeType": "image/jpeg"
  },
  "meta": {
    "requestId": "request-123",
    "timestamp": "2026-07-22T14:00:00.000Z"
  }
}
```

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

| 方法 | 路径             | 说明             | 权限 |
| ---- | ---------------- | ---------------- | ---- |
| POST | `/auth/login`    | 用户登录         | 公开 |
| POST | `/auth/register` | 用户注册         | 公开 |
| POST | `/auth/refresh`  | 刷新Token        | 公开 |
| POST | `/auth/logout`   | 退出登录         | 认证 |
| GET  | `/auth/profile`  | 获取当前用户信息 | 认证 |

### 用户模块 (/users)

| 方法   | 路径                 | 说明         | 权限       |
| ------ | -------------------- | ------------ | ---------- |
| GET    | `/users`             | 用户列表     | ADMIN      |
| GET    | `/users/{id}`        | 用户详情     | 认证       |
| PUT    | `/users/{id}`        | 更新用户信息 | 本人/ADMIN |
| DELETE | `/users/{id}`        | 删除用户     | ADMIN      |
| PATCH  | `/users/{id}/avatar` | 更新头像     | 本人       |

### 宠物模块 (/pets)

| 方法   | 路径         | 说明         | 权限       |
| ------ | ------------ | ------------ | ---------- |
| GET    | `/pets`      | 我的宠物列表 | 认证       |
| POST   | `/pets`      | 添加宠物     | 认证       |
| GET    | `/pets/{id}` | 宠物详情     | 本人/ADMIN |
| PUT    | `/pets/{id}` | 更新宠物信息 | 本人       |
| DELETE | `/pets/{id}` | 删除宠物     | 本人       |

### 订单模块 (/orders)

| 方法  | 路径                    | 说明     | 权限     |
| ----- | ----------------------- | -------- | -------- |
| GET   | `/orders`               | 订单列表 | 认证     |
| POST  | `/orders`               | 创建订单 | USER     |
| GET   | `/orders/{id}`          | 订单详情 | 相关方   |
| PUT   | `/orders/{id}`          | 更新订单 | 相关方   |
| PATCH | `/orders/{id}/cancel`   | 取消订单 | 用户     |
| PATCH | `/orders/{id}/confirm`  | 确认接单 | PROVIDER |
| PATCH | `/orders/{id}/complete` | 完成订单 | PROVIDER |

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

### 文件上传 (/uploads)

| 方法 | 路径                 | 说明     | 权限 |
| ---- | -------------------- | -------- | ---- |
| POST | `/uploads/images`    | 上传图片 | 认证 |
| POST | `/uploads/documents` | 上传文档 | 认证 |

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

**最后更新**: 2026-07-23
**维护者**: PetCare 后端团队  
**版本**: v1.0
