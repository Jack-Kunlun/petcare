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
   - ✅ `/api/v1/users` - 用户列表
   - ❌ `/api/v1/getUsers` - 动词开头

2. **HTTP方法语义**：
   - `GET` - 查询资源
   - `POST` - 创建资源
   - `PUT` - 全量更新资源
   - `PATCH` - 部分更新资源
   - `DELETE` - 删除资源

3. **层级关系**：使用嵌套路径表示从属关系
   - `/api/v1/users/{id}/orders` - 用户的订单列表

### 一致性

- 所有API统一前缀：`/api/v1`
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
开发环境: http://localhost:3001/api/v1
生产环境: https://api.petcare.com/api/v1
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
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "encrypted_password",
  "loginType": "MINIAPP" // MINIAPP | ADMIN
}
```

**响应**：

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800,
    "user": {
      "id": "uuid",
      "name": "张三",
      "avatar": "https://...",
      "role": "USER"
    }
  }
}
```

#### Token 刷新

**请求**：

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

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
GET /api/v1/orders?status=PENDING&page=1&pageSize=20&sortBy=createdAt&order=DESC
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
POST /api/v1/orders
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
PUT /api/v1/orders/{id}
{
  "status": "CONFIRMED",
  "assignedProviderId": "uuid",
  "scheduledTime": "2026-07-20T15:00:00.000Z"
}
```

**部分更新 (PATCH)**：

```json
PATCH /api/v1/orders/{id}
{
  "status": "IN_PROGRESS"
}
```

### 文件上传

使用 `multipart/form-data`：

```http
POST /api/v1/uploads/images
Content-Type: multipart/form-data

file: (binary)
```

**响应**：

```json
{
  "code": 200,
  "data": {
    "url": "https://oss.petcare.com/images/xxx.jpg",
    "thumbnailUrl": "https://oss.petcare.com/images/xxx_thumb.jpg",
    "size": 1024000,
    "mimeType": "image/jpeg"
  }
}
```

---

## 响应规范

### 成功响应

**统一格式**：

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": "2026-07-16T10:00:00.000Z"
}
```

**单个资源**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "name": "张三",
    "phone": "138****8000",
    "createdAt": "2026-07-16T10:00:00.000Z"
  },
  "timestamp": "2026-07-16T10:00:00.000Z"
}
```

**资源列表**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "订单1",
        "status": "PENDING"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "timestamp": "2026-07-16T10:00:00.000Z"
}
```

### HTTP 状态码

| 状态码 | 说明                  | 使用场景               |
| ------ | --------------------- | ---------------------- |
| 200    | OK                    | 请求成功               |
| 201    | Created               | 资源创建成功           |
| 204    | No Content            | 删除成功（无返回内容） |
| 400    | Bad Request           | 请求参数错误           |
| 401    | Unauthorized          | 未认证或Token过期      |
| 403    | Forbidden             | 无权限访问             |
| 404    | Not Found             | 资源不存在             |
| 409    | Conflict              | 资源冲突（如重复提交） |
| 422    | Unprocessable Entity  | 业务逻辑验证失败       |
| 429    | Too Many Requests     | 请求频率超限           |
| 500    | Internal Server Error | 服务器内部错误         |

---

## 错误处理

### 错误响应格式

```json
{
  "code": 400,
  "message": "请求参数错误",
  "errors": [
    {
      "field": "phone",
      "message": "手机号格式不正确",
      "value": "12345"
    },
    {
      "field": "password",
      "message": "密码长度至少6位",
      "value": "123"
    }
  ],
  "timestamp": "2026-07-16T10:00:00.000Z",
  "requestId": "uuid"
}
```

### 常见错误码

| code | message             | 说明         |
| ---- | ------------------- | ------------ |
| 400  | INVALID_PARAMS      | 参数验证失败 |
| 401  | UNAUTHORIZED        | 未认证       |
| 401  | TOKEN_EXPIRED       | Token已过期  |
| 403  | FORBIDDEN           | 无权限       |
| 404  | NOT_FOUND           | 资源不存在   |
| 409  | DUPLICATE_ENTRY     | 重复数据     |
| 422  | VALIDATION_FAILED   | 业务验证失败 |
| 429  | RATE_LIMIT_EXCEEDED | 请求超限     |
| 500  | INTERNAL_ERROR      | 服务器错误   |

### 全局异常处理

Nest.js 使用全局异常过滤器统一处理异常：

```typescript
// apps/server/src/filters/http-exception.filter.ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 统一错误响应格式
    response.status(statusCode).json({
      code: statusCode,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 分页规范

### 游标分页（推荐）

适用于大数据量场景：

**请求**：

```
GET /api/v1/orders?cursor=abc123&limit=20
```

**响应**：

```json
{
  "code": 200,
  "data": {
    "items": [...],
    "cursor": {
      "next": "def456",
      "hasMore": true
    }
  }
}
```

### Offset 分页（传统）

适用于小数据量场景：

**请求**：

```
GET /api/v1/orders?page=1&pageSize=20
```

**响应**：

```json
{
  "code": 200,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

## 版本管理

### URL 版本化

```
/api/v1/users     - 当前稳定版本
/api/v2/users     - 新版本（开发中）
```

### 版本策略

- **v1**：长期支持版本（LTS）
- **v2**：新功能版本
- 废弃版本保留至少6个月

### 版本协商

也可通过请求头指定版本：

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
  "code": 429,
  "message": "请求频率超限，请稍后重试",
  "retryAfter": 30,
  "timestamp": "2026-07-16T10:00:00.000Z"
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

@ApiTags("用户")
@ApiBearerAuth()
@Controller("users")
export class UserController {
  @Get()
  @ApiOperation({ summary: "获取用户列表" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "成功",
    type: PaginatedResponseDto,
  })
  async findAll(@Query() query: PaginationDto) {
    return this.userService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取用户详情" })
  @ApiParam({ name: "id", description: "用户ID" })
  @ApiResponse({
    status: 200,
    description: "成功",
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "用户不存在",
  })
  async findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }
}
```

### 访问Swagger UI

- **开发环境**: http://localhost:3001/api-docs
- **生产环境**: 已禁用

---

## 最佳实践

### 1. 幂等性

对于可能重复提交的接口（如创建订单），使用幂等键：

```http
POST /api/v1/orders
Idempotency-Key: unique-request-id-123
```

### 2. 部分字段返回

使用 `fields` 参数指定返回字段：

```
GET /api/v1/users?fields=id,name,avatar
```

### 3. 条件请求

使用 ETag 进行缓存优化：

```http
GET /api/v1/users/123
If-None-Match: "etag-value"

// 如果资源未修改，返回 304 Not Modified
```

### 4. 批量操作

提供批量操作接口减少请求次数：

```http
POST /api/v1/users/batch
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
POST /api/v1/orders
{
  "callbackUrl": "https://yourdomain.com/webhook/order-status",
  "callbackEvents": ["CONFIRMED", "COMPLETED"]
}
```

---

## 附录

### 项目内相关文档

- [技术架构](../03-technical-architecture/01-tech-stack.md) - 后端技术栈说明
- [开发规范](../07-development-guidelines/02-development-standards.md) - Nest.js开发规范
- [环境变量配置](../environment-variables.md) - API服务配置项
- [部署指南](../06-deployment/deployment.md) - API服务部署说明

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

**最后更新**: 2026-07-16  
**维护者**: PetCare 后端团队  
**版本**: v1.0
