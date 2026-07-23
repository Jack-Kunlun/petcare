# PetCare Server 日志服务设计

**日期**：2026-07-23  
**状态**：已实施

## 1. 背景与目标

Server 已安装 `winston`，Docker Compose 也已把宿主机 `./logs/server` 挂载到容器 `/app/logs`，但当前没有统一日志模块。Nest 启动日志仍使用默认 Logger；HTTP 请求没有统一访问日志；全局异常过滤器只对 500 错误调用 Nest Logger；日志级别、结构、轮转、脱敏和保留策略均不可配置。

本次目标：

- 建立可由 Nest 启动过程、框架组件和业务服务共同使用的全局日志服务。
- 统一控制台和文件输出，生产环境使用结构化 JSON。
- 用现有 `requestId` 串联访问日志、异常日志和客户端错误反馈。
- 记录请求耗时、状态和必要正文，同时阻止敏感信息泄露。
- 每日轮转文件，限制单文件大小并自动清理历史日志。
- 保持日志故障与业务响应隔离，避免日志系统错误递归或泄露到客户端。

## 2. 方案选择

采用自定义 Nest Logger 适配器：

- 使用现有 `winston` 作为日志核心。
- 新增 `winston-daily-rotate-file` 提供按天轮转、压缩和保留策略。
- 不引入 `nestjs-winston`，避免额外框架包装。
- 不使用手写文件流，避免自行处理并发写入、轮转和压缩。

## 3. 模块与组件

### 3.1 LoggingModule

新增全局 `LoggingModule`，负责提供：

- `AppLogger`：实现 Nest `LoggerService`，同时提供结构化日志方法。
- Winston logger 实例：封装 transports、formats 和日志级别。
- `LogSanitizer`：递归脱敏和正文截断，不依赖 HTTP 层。
- `HttpLoggingMiddleware`：记录每个 HTTP 请求的完成事件。

业务代码只注入 `AppLogger`，不得直接创建 Winston 实例或读取日志环境变量。

### 3.2 启动日志接管

`main.ts` 使用：

1. `NestFactory.create(AppModule, { bufferLogs: true })` 暂存启动阶段日志。
2. 从容器取得 `AppLogger`。
3. 调用 `app.useLogger(appLogger)` 和 `app.flushLogs()`。
4. 启用 shutdown hooks，使日志 transport 在应用关闭时刷新并释放。

这样 Nest 框架日志、应用日志和异常日志使用同一格式与输出策略。

### 3.3 HTTP 访问日志

在同一 middleware chain 中按顺序注册：

1. `RequestIdMiddleware`
2. `HttpLoggingMiddleware`

HTTP 日志中间件监听响应 `finish` 和连接 `close`，并确保每个请求只记录一次。默认字段：

- `event: "http.request.completed"`
- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `ip`
- `userAgent`
- 脱敏后的 `query`
- 脱敏后的 `body`

不记录响应正文。状态码小于 400 使用 `info`，4xx 使用 `warn`，5xx 使用 `error`。

### 3.4 异常日志

`ApiExceptionFilter` 改为注入 `AppLogger`，不再自行创建 Nest Logger。

对 5xx 异常记录：

- `event: "http.exception"`
- `requestId`
- `method`
- `path`
- `statusCode`
- 稳定业务错误码
- 异常类型
- 服务端异常消息与堆栈

客户端响应仍保持现有统一错误 envelope，不返回堆栈、数据库错误或内部路径。4xx 由访问日志记录，不重复写一份异常堆栈日志。

## 4. 输出与轮转

### 4.1 控制台

- 开发环境：带时间、级别、上下文的可读彩色文本。
- 生产环境：单行 JSON，便于 Docker 或日志平台采集。
- 控制台和文件都遵守 `LOG_LEVEL`。

### 4.2 文件

输出两个 JSON 日志文件：

- `application-%DATE%.log`：应用、访问和异常日志。
- `error-%DATE%.log`：仅 `error` 级别日志。

两个 transport 都采用：

- 每日轮转。
- 单文件最大 20MB。
- 历史文件 gzip 压缩。
- 保留 14 天。
- UTC 时间戳。

文件 transport 初始化或写入失败时，错误直接写入 `stderr`，不再次调用 `AppLogger`，避免递归。控制台 transport 继续工作，应用不因文件日志暂时不可写而退出。

## 5. 配置

新增 ConfigService getter：

- `logLevel`：允许 `error | warn | info | http | verbose | debug | silly`，默认 `info`；非法值启动失败。
- `logDirectory`：读取 `LOG_DIR`；本地默认解析为仓库 `logs/server`。相对路径始终以 monorepo 根目录为基准，不依赖 pnpm 启动时的当前工作目录。
- `logRawRequestBody`：只读派生值，仅当 `NODE_ENV !== "production"` 且 `LOG_LEVEL=debug` 时为 `true`。

新增环境变量：

```env
LOG_LEVEL=info
LOG_DIR=./logs/server
```

Docker Compose 为 Server 显式设置：

```yaml
LOG_LEVEL: ${LOG_LEVEL:-info}
LOG_DIR: /app/logs
```

生产环境即使误设 `LOG_LEVEL=debug`，`logRawRequestBody` 仍为 `false`。

## 6. 脱敏和正文限制

### 6.1 始终脱敏

请求正文和查询参数中的以下键不区分大小写、递归匹配并替换为 `[REDACTED]`：

- `password`、`passwordHash`
- `token`、`accessToken`、`refreshToken`
- `authorization`、`cookie`
- `secret`、`appSecret`
- `code`、`smsCode`、`verificationCode`、`captchaAnswer`

业务日志顶层的稳定错误 `code` 不经过请求正文脱敏器，因此仍可检索。

### 6.2 生产环境额外脱敏

生产环境对以下个人信息进行掩码处理：

- 手机号
- OpenID
- 邮箱
- 地址

### 6.3 开发调试原文

默认访问日志始终包含脱敏正文。

当且仅当非生产环境显式设置 `LOG_LEVEL=debug` 时，额外输出 `http.request.raw` 调试事件，包含原始 `query` 和 `body`。该行为必须在文档中标记为敏感，仅用于短时本地排查；生产环境没有任何配置可以启用原始正文。

### 6.4 截断

正文和查询参数序列化后最大 8KB。超出部分截断，并记录：

- `truncated: true`
- `originalLength`

循环引用、不可序列化值和异常 getter 不得导致请求失败；脱敏器返回安全占位信息。

## 7. 使用约定

业务服务通过上下文 logger 记录事件：

```ts
this.logger.info("order.created", {
  orderId,
  ownerId,
  requestId,
});
```

日志消息使用稳定的点分事件名，动态信息放在结构化 metadata 中。禁止字符串拼接密码、Token、验证码或完整第三方响应。

本次只接入：

- Nest 启动和框架日志。
- HTTP 请求完成日志。
- 5xx 异常日志。
- 服务启动成功日志。

具体订单、支付、审核等业务审计事件在对应功能实现时逐项加入，不在本次基础设施任务中批量改造。

## 8. 测试策略

按测试先行实施：

1. ConfigService 测试覆盖默认级别、合法/非法级别、日志目录和生产环境原文禁用。
2. LogSanitizer 测试覆盖递归核心凭据脱敏、生产 PII 掩码、循环引用和 8KB 截断。
3. AppLogger 测试通过注入或 mock Winston 实例验证 Nest 方法映射、上下文与异常堆栈。
4. HttpLoggingMiddleware 测试覆盖成功、4xx、5xx、耗时、requestId、只记录一次和开发 debug 原文事件。
5. ApiExceptionFilter 测试改为验证注入的 `AppLogger` 收到结构化 5xx 日志。
6. 启动与模块测试验证 LoggingModule 为全局模块且 Nest 可以取得 Logger。
7. 运行 Server 全量测试、Lint、构建、格式检查和 Docker Compose 配置解析。

测试不写入真实长期日志目录；transport 工厂必须允许测试使用内存或 mock transport。

## 9. 文档与部署

同步更新：

- `.env.example`
- `docs/environment-variables.md`
- Server 架构/开发规范
- Docker Compose Server 环境变量
- Docker 日志使用说明

`logs/server` 保持 Git 忽略，Docker 继续挂载宿主机目录。不得修改或提交本地实际环境文件。

## 10. 完成标准

- Nest 启动日志、HTTP 访问日志和 5xx 异常日志统一经过 `AppLogger`。
- 控制台与两个轮转文件按环境输出正确格式。
- 所有请求日志包含与响应一致的 `requestId`。
- 轮转策略为每天、20MB、压缩、保留 14 天。
- 默认日志不包含密码、验证码、Token、Cookie 或 Secret。
- 生产环境无法输出原始正文。
- 开发环境只有显式 `LOG_LEVEL=debug` 才输出原始正文。
- 日志文件失败时控制台仍可工作，业务请求不受影响。
- 相关测试、Server 全量测试、Lint、构建、格式和 Docker 配置检查通过。
