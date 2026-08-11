# 环境变量配置指南

## 环境变量列表

### 服务器配置

| 变量名     | 必填 | 默认值        | 说明                                    |
| ---------- | ---- | ------------- | --------------------------------------- |
| `PORT`     | 否   | `3000`        | 服务器端口号                            |
| `NODE_ENV` | 否   | `development` | 运行环境（development/test/production） |

### 日志配置

| 变量名      | 必填 | 默认值          | 说明                                                                    |
| ----------- | ---- | --------------- | ----------------------------------------------------------------------- |
| `LOG_LEVEL` | 否   | `info`          | `error`、`warn`、`info`、`http`、`verbose`、`debug` 或 `silly`          |
| `LOG_DIR`   | 否   | `./logs/server` | 日志目录；相对路径以 monorepo 根目录为基准，Docker 中固定为 `/app/logs` |

日志同时输出到控制台和文件。文件名为 `application-%DATE%.log`（全部日志）与
`error-%DATE%.log`（仅错误日志），每天或达到 20MB 时轮转，归档使用 gzip 压缩并保留 14 天。

请求正文和查询参数默认递归脱敏密码、Token、Cookie、Secret、验证码等凭据；生产环境还会掩码手机号、
OpenID、邮箱和地址。仅在非生产环境显式设置 `LOG_LEVEL=debug` 时，才会额外写入
`http.request.raw` 原始正文事件。原始正文可能包含敏感数据，只能用于短时本地排查；生产环境无法启用该行为。

### 数据库配置（独立配置项）

| 变量名        | 必填 | 默认值      | 说明                  |
| ------------- | ---- | ----------- | --------------------- |
| `DB_HOST`     | ✅   | `localhost` | 数据库主机地址        |
| `DB_PORT`     | ✅   | `5432`      | 数据库端口号          |
| `DB_USERNAME` | ✅   | -           | 数据库用户名          |
| `DB_PASSWORD` | ✅   | -           | 数据库密码            |
| `DB_NAME`     | ✅   | `petcare`   | 数据库名称            |
| `DB_SCHEMA`   | ✅   | `public`    | PostgreSQL Schema名称 |

示例：

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=petcare
DB_PASSWORD=replace-with-a-local-strong-password
DB_NAME=petcare
DB_SCHEMA=public
```

### Redis配置（独立配置项）

| 变量名           | 必填     | 默认值      | 说明                                        |
| ---------------- | -------- | ----------- | ------------------------------------------- |
| `REDIS_HOST`     | ✅       | `localhost` | Redis主机地址                               |
| `REDIS_PORT`     | ✅       | `6379`      | Redis端口号                                 |
| `REDIS_PASSWORD` | 生产必填 | -           | Redis密码；无认证的本地或隔离测试环境可留空 |

示例：

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 异步任务与 Worker 配置

| 变量名                    | 必填 | 默认值      | 说明                                                |
| ------------------------- | ---- | ----------- | --------------------------------------------------- |
| `QUEUE_PREFIX`            | 否   | `petcare`   | BullMQ 队列前缀；不同环境必须使用不同前缀           |
| `WORKER_CONCURRENCY`      | 否   | `5`         | 单个 Worker 的并发任务数，必须为正整数              |
| `OUTBOX_POLL_INTERVAL_MS` | 否   | `1000`      | Transactional Outbox 轮询间隔（毫秒），必须为正整数 |
| `ORDER_TIMEOUT_DELAY_MS`  | 否   | `172800000` | 悬赏订单超时关闭延迟（48 小时，毫秒），必须为正整数 |

API 和独立 Worker 必须使用相同的 `QUEUE_PREFIX`；生产、预发和开发环境必须使用不同前缀，避免任务串扰。

### JWT配置

| 变量名                      | 必填 | 默认值   | 说明                                      |
| --------------------------- | ---- | -------- | ----------------------------------------- |
| `JWT_SECRET`                | ✅   | -        | JWT签名密钥（至少 32 位，生产环境需随机） |
| `JWT_ACCESS_EXPIRES_IN`     | 否   | `15m`    | Access Token 有效期                       |
| `JWT_REFRESH_EXPIRES_IN`    | 否   | `7d`     | Refresh Token 有效期                      |
| `REFRESH_TOKEN_TTL_SECONDS` | 否   | `604800` | Redis 中 Refresh Token 会话有效期（秒）   |

### 管理员认证配置

| 变量名                      | 必填 | 默认值  | 说明                                  |
| --------------------------- | ---- | ------- | ------------------------------------- |
| `DEFAULT_ADMIN_USERNAME`    | ✅   | `admin` | 初始管理员账号                        |
| `DEFAULT_ADMIN_PHONE`       | ✅   | -       | 初始管理员手机号                      |
| `DEFAULT_ADMIN_PASSWORD`    | ✅   | -       | 初始管理员密码，至少 12 位            |
| `SMS_DEV_CODE`              | 否   | -       | 本地固定 6 位验证码；生产环境禁止配置 |
| `SMS_CODE_TTL_SECONDS`      | 否   | `300`   | 验证码有效期                          |
| `SMS_SEND_COOLDOWN_SECONDS` | 否   | `60`    | 同一手机号发送冷却时间                |
| `SMS_HOURLY_LIMIT`          | 否   | `5`     | 同一手机号每小时发送上限              |
| `SMS_MAX_ATTEMPTS`          | 否   | `5`     | 单个验证码最大校验失败次数            |
| `CAPTCHA_TTL_SECONDS`       | 否   | `300`   | 图形验证码有效期，必须为正整数        |
| `CAPTCHA_MAX_ATTEMPTS`      | 否   | `5`     | 图形验证码最大校验失败次数            |

开发环境可设置 `SMS_DEV_CODE=246810` 进行本地联调。接口不会把验证码返回给前端；生产环境必须接入真实短信发送器，并移除该变量。

发送短信验证码之前必须先通过图形验证码。图形验证码由 Server 生成无文本节点的 SVG，Redis 只保存 HMAC 摘要；校验成功后立即消费，同一个挑战不能重复使用。

### API配置

| 变量名                      | 必填 | 说明                                              |
| --------------------------- | ---- | ------------------------------------------------- |
| `API_BASE_URL`              | 否   | Admin API基础URL，默认`http://localhost:8986/api` |
| ~~`TARO_APP_API_BASE_URL`~~ | -    | ~~Taro Miniapp 请求地址；已随项目删除~~           |

### 第三方服务（可选）

| 变量名                         | 说明                       |
| ------------------------------ | -------------------------- |
| `WECHAT_APP_ID`                | 微信小程序AppID            |
| `WECHAT_APP_SECRET`            | 微信小程序AppSecret        |
| `ALIYUN_OSS_ACCESS_KEY_ID`     | 阿里云OSS AccessKey ID     |
| `ALIYUN_OSS_ACCESS_KEY_SECRET` | 阿里云OSS AccessKey Secret |
| `ALIYUN_OSS_BUCKET`            | 阿里云OSS Bucket名称       |
| `ALIYUN_OSS_REGION`            | 阿里云OSS区域              |

微信配置必须同时留空或同时提供。启用时，`WECHAT_APP_ID` 必须符合 `wx` 加 16 位字符的格式，
`WECHAT_APP_SECRET` 必须为 32 位十六进制字符串。

~~Miniapp 只读取 `TARO_APP_API_BASE_URL`，并从 `apps/miniapp/project.config.json` 取得公开 AppID。~~

`WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 只由 Server 使用，任何客户端都不得包含或读取 AppSecret。UniApp 的业务请求边界尚未迁移，相关客户端变量将在实际接入时另行确定。

OSS 配置必须四项同时留空或同时提供；Bucket 只能使用小写字母、数字和连字符，Region 使用
类似 `cn-hangzhou` 的格式。任何不完整或格式错误的字段组都会在 Server 监听端口前使启动失败。

## 使用方法

1. 在仓库根目录复制配置模板：

   ```bash
   cp .env.example .env
   ```

2. 编辑根目录 `.env`，填入本地数据库、Redis、JWT 和默认管理员配置。

3. 启动基础设施并初始化：

   ```bash
   docker compose up -d postgres redis
   pnpm --filter @petcare/server prisma:push
   pnpm --filter @petcare/server prisma:seed
   ```

4. ~~启动 Server 和 Taro Miniapp 微信端监听构建：~~

   ```bash
   pnpm dev:server
   # pnpm dev:miniapp（已删除）
   ```

5. ~~在微信开发者工具中导入 `apps/miniapp`，并通过 `TARO_APP_API_BASE_URL` 配置请求地址。~~

   原 Taro 联调流程已弃用；UniApp 业务请求尚未迁移，不沿用旧变量和旧项目配置。

## 注意事项

- ⚠️ **永远不要**将根目录 `.env` 提交到 Git 仓库
- ⚠️ 生产环境的 `JWT_SECRET` 必须使用强随机字符串
- ⚠️ 生产环境必须设置独立的 `DB_PASSWORD`、`REDIS_PASSWORD` 和默认管理员密码
- ⚠️ 生产环境不得设置 `SMS_DEV_CODE`
- ⚠️ 数据库密码不要使用弱口令
- ✅ 每个开发者应有自己的本地根 `.env`
- ✅ CI/CD 环境只注入隔离测试凭据；生产值由部署平台注入

## 代码中的使用方式

### ConfigService

业务模块禁止直接读取 `process.env`。所有配置（包括数据库、Redis、队列和第三方密钥）都必须通过 `ConfigService` 获取；只有 `ConfigService` 本身可以读取环境变量。

```typescript
import { Injectable } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";

@Injectable()
export class ExampleService {
  constructor(private readonly configService: ConfigService) {}

  getQueueSettings() {
    return {
      prefix: this.configService.queuePrefix,
      concurrency: this.configService.workerConcurrency,
    };
  }
}
```

Prisma CLI 通过 `apps/server/prisma.config.ts` 使用同一个 `ConfigService`，从独立 `DB_*`
变量生成连接地址。业务模块不得自行拼接连接字符串。
