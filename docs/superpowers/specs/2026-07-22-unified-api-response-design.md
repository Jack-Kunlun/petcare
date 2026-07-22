# PetCare 统一 API 响应与 Swagger 返回模型设计

**日期**：2026-07-22
**状态**：待实现

## 1. 背景与目标

当前 Server 控制器直接返回业务数据，只声明了请求 DTO 和 `@ApiOperation`。Swagger 无法推断服务层返回结构，因此接口文档缺少成功响应类型；异常响应也没有统一模型。Admin、Miniapp 和共享 API Client 需要分别猜测数据结构和处理错误。

本次改造目标：

- 为所有现有 HTTP JSON 接口提供统一、稳定的响应外层。
- 保留正确的 HTTP 状态码，不使用“所有请求都返回 200”的设计。
- 通过 Swagger 显示每个接口的具体 `data` 类型及公共错误结构。
- 统一 Admin、Miniapp 和共享 API Client 的解包与错误处理方式。
- 避免在用户响应和 Swagger 文档中暴露 `passwordHash` 等敏感字段。

## 2. 统一响应协议

### 2.1 成功响应

除特殊接口外，成功响应统一为：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {},
  "meta": {
    "requestId": "01J...",
    "timestamp": "2026-07-22T22:00:00.000Z"
  }
}
```

字段约束：

- `code`：稳定的业务代码。通用成功值为 `SUCCESS`。
- `message`：面向调用方的简短说明，不承载调试堆栈。
- `data`：接口具体返回数据；无业务数据时为 `null`。
- `meta.requestId`：本次请求的链路标识。
- `meta.timestamp`：服务端生成的 ISO 8601 UTC 时间。

分页接口的分页信息放在 `data` 内，保持现有业务结构：

```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "orders": [],
    "total": 0,
    "page": 1,
    "pageSize": 20
  },
  "meta": {
    "requestId": "01J...",
    "timestamp": "2026-07-22T22:00:00.000Z"
  }
}
```

### 2.2 错误响应

异常统一为同一外层：

```json
{
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "账号或凭据错误",
  "data": null,
  "meta": {
    "requestId": "01J...",
    "timestamp": "2026-07-22T22:00:00.000Z"
  }
}
```

HTTP 状态码继续表达协议语义：参数错误为 400、未认证为 401、无权限为 403、资源不存在为 404、频率限制为 429、服务内部异常为 500。

业务错误代码使用大写下划线形式，并按领域分组，例如：

- `VALIDATION_FAILED`
- `AUTH_INVALID_CAPTCHA`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_SESSION_EXPIRED`
- `RESOURCE_NOT_FOUND`
- `RATE_LIMIT_EXCEEDED`
- `INTERNAL_SERVER_ERROR`

未知异常不得向客户端返回堆栈、数据库错误或内部路径；详细信息仅进入服务端日志，并通过 `requestId` 关联。

## 3. 后端架构

### 3.1 请求上下文

新增全局请求标识中间件：

- 优先接受格式合法的 `X-Request-Id` 请求头。
- 缺失或不合法时由服务端生成 UUID。
- 将 ID 写入请求对象和 `X-Request-Id` 响应头。
- 响应拦截器、异常过滤器和日志组件读取同一 ID。

### 3.2 成功响应拦截器

全局 `ApiResponseInterceptor` 只负责成功响应：

- 将控制器返回值包装成统一结构。
- 不包装已经明确标记为原始响应的接口。
- 不二次包装已经符合统一协议的值。
- 根据路由元数据允许覆盖成功 `code` 和 `message`。

控制器和服务继续返回原始业务对象，例如 `{ accessToken, user }`；拦截器在 HTTP 边界完成包装，避免统一协议侵入领域服务。

### 3.3 全局异常过滤器

`ApiExceptionFilter` 负责将异常映射为统一错误响应：

- 识别 Nest `HttpException` 的状态码和安全消息。
- 将 `class-validator` 的数组消息归一为 `VALIDATION_FAILED`，客户端只收到安全、可读的信息。
- 识别项目自定义业务异常的稳定业务代码。
- 未知异常固定返回 500 和 `INTERNAL_SERVER_ERROR`。
- 记录状态码、业务代码、路径、方法、requestId 和服务端异常详情。

### 3.4 特殊响应边界

以下响应不进入 JSON 包装：

- `204 No Content`，例如退出登录。
- 文件下载和二进制响应。
- 流式响应、SSE。
- 明确使用 `@Res()` 完全接管响应的路由。

认证接口当前使用 `@Res({ passthrough: true })` 设置 Cookie，仍由 Nest 处理返回值，因此继续包装。

## 4. Swagger 模型与装饰器

### 4.1 公共模型

建立 Swagger DTO：

- `ApiResponseMetaDto`
- `ApiErrorResponseDto`
- 各领域具体响应 DTO

建立组合装饰器：

- `@ApiSuccessResponse(Model, options)`：使用 `allOf` 组合统一外层和具体 `data` schema。
- `@ApiErrorResponses(...)`：声明接口可能出现的标准错误状态和模型。
- `@ApiNoContentResponse()`：用于 204 接口。
- `@RawResponse()`：标记不包装的特殊接口，并允许文档声明原始类型。

### 4.2 当前接口响应类型

Auth：

- `GET /auth/captcha` → `CaptchaResponseDto`
- `POST /auth/sms/send` → `MessageResponseDto`
- `POST /auth/login/password` → `AdminLoginResponseDto`
- `POST /auth/login/sms` → `AdminLoginResponseDto`
- `POST /auth/refresh` → `AdminLoginResponseDto`
- `POST /auth/logout` → 204，无响应体
- `GET /auth/me` → `AdminUserResponseDto`

Health：

- `GET /health` → `HealthResponseDto`

Users：

- `POST /users/register` → `UserRegisterResponseDto`
- `GET /users/:id` → `UserResponseDto`，不存在时返回 404

Orders：

- `POST /orders/reward` → `CreateOrderResponseDto`
- `GET /orders` → `OrderListResponseDto`
- `GET /orders/:id` → `OrderDetailResponseDto`，不存在时返回 404

所有模型使用 `@ApiProperty` 或 Swagger CLI 可识别的类属性声明。日期字段在文档中使用 `date-time` 格式；可空字段显式标记 `nullable`。

## 5. 数据安全与运行时一致性

响应 DTO 必须与实际 JSON 一致。User 服务改为 Prisma `select`，只返回公开字段：

- `id`
- `openid`（仅业务确实需要时；当前公共响应不返回）
- `phone`
- `username`
- `nickname`
- `avatar`
- `userType`
- `status`
- `createdAt`
- `updatedAt`

`passwordHash` 永远不进入响应、日志或 Swagger schema。

Order 详情中的 owner 和 pet 使用独立安全 DTO，不直接把完整 Prisma 关联模型当作公开 API 模型。

## 6. 客户端适配

### 6.1 Admin

Admin Axios 实例统一解包 `response.data.data`，业务调用仍获得原有的 `T`，避免页面组件感知协议外层。

错误拦截器读取：

- HTTP 状态码用于认证刷新和跳转。
- `response.data.code` 用于稳定业务判断。
- `response.data.message` 用于安全提示。

刷新令牌流程必须避免对 `/auth/refresh` 自身重复刷新。

### 6.2 API Client 与 Miniapp

共享 API Client 增加泛型：

```ts
interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  meta: ApiResponseMeta;
}
```

HTTP 层负责解包并将标准错误转换为统一客户端异常。Miniapp 后续通过共享 API Client 获得同样行为；现有未接入共享客户端的调用需同步适配，不能保留两套响应判断方式。

## 7. 测试策略

按测试先行实施：

1. Swagger 文档测试先证明当前路由缺少成功响应 schema。
2. 拦截器单元测试覆盖普通对象、数组、`null`、已包装值和跳过包装元数据。
3. 异常过滤器测试覆盖 400、401、403、404、429、500，以及未知异常脱敏。
4. 请求 ID 测试覆盖传入合法 ID、拒绝非法 ID和服务端生成 ID。
5. 控制器/Swagger 测试检查所有现有路由的成功类型、错误类型和 204 响应。
6. User/Order 服务测试证明敏感字段不会被查询或返回。
7. Admin 和 API Client 测试覆盖成功解包、业务错误、401 刷新和刷新失败。
8. 运行 Server、Admin、Miniapp 与共享包的全量测试、Lint 和构建。

## 8. 兼容与上线策略

项目仍处于早期开发阶段，本次直接切换统一协议，不保留旧响应格式，也不引入双写兼容层。Server 与所有仓库内客户端必须在同一提交中完成适配。

数据库结构不变，不需要迁移。Docker 和环境变量无需新增业务配置。

## 9. 完成标准

- Swagger 中所有现有 JSON 接口都显示统一外层和具体 `data` 类型。
- Swagger 中列出接口实际可能返回的主要错误状态。
- 所有 JSON 成功与错误响应符合统一协议，特殊响应遵守跳过规则。
- HTTP 状态码保持正确。
- Admin、Miniapp 和共享 API Client 能正常处理新协议。
- `passwordHash` 等敏感字段不出现在运行时响应和 Swagger 文档中。
- 全量测试、Lint、构建和格式检查通过。
