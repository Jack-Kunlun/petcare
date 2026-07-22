# 环境变量配置指南

## 环境变量列表

### 服务器配置

| 变量名     | 必填 | 默认值        | 说明                               |
| ---------- | ---- | ------------- | ---------------------------------- |
| `PORT`     | 否   | `3000`        | 服务器端口号                       |
| `NODE_ENV` | 否   | `development` | 运行环境（development/production） |

### 数据库配置（独立配置项）

| 变量名        | 必填 | 默认值      | 说明                  |
| ------------- | ---- | ----------- | --------------------- |
| `DB_HOST`     | ✅   | `localhost` | 数据库主机地址        |
| `DB_PORT`     | ✅   | `5432`      | 数据库端口号          |
| `DB_USERNAME` | ✅   | -           | 数据库用户名          |
| `DB_PASSWORD` | ✅   | -           | 数据库密码            |
| `DB_NAME`     | ✅   | `petcare`   | 数据库名称            |
| `DB_SCHEMA`   | 否   | `public`    | PostgreSQL Schema名称 |

示例：

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=petcare
DB_PASSWORD=password123
DB_NAME=petcare
DB_SCHEMA=public
```

### Redis配置（独立配置项）

| 变量名           | 必填 | 默认值      | 说明                          |
| ---------------- | ---- | ----------- | ----------------------------- |
| `REDIS_HOST`     | ✅   | `localhost` | Redis主机地址                 |
| `REDIS_PORT`     | ✅   | `6379`      | Redis端口号                   |
| `REDIS_PASSWORD` | 否   | -           | Redis密码（未启用认证时留空） |

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

| 变量名                   | 必填 | 默认值 | 说明                                      |
| ------------------------ | ---- | ------ | ----------------------------------------- |
| `JWT_SECRET`             | ✅   | -      | JWT签名密钥（至少 32 位，生产环境需随机） |
| `JWT_ACCESS_EXPIRES_IN`  | 否   | `15m`  | Access Token 有效期                       |
| `JWT_REFRESH_EXPIRES_IN` | 否   | `7d`   | Refresh Token 有效期                      |

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

| 变量名         | 必填 | 说明                                        |
| -------------- | ---- | ------------------------------------------- |
| `API_BASE_URL` | 否   | API基础URL，默认`http://localhost:8986/api` |

### 第三方服务（可选）

| 变量名                         | 说明                       |
| ------------------------------ | -------------------------- |
| `WECHAT_APP_ID`                | 微信小程序AppID            |
| `WECHAT_APP_SECRET`            | 微信小程序AppSecret        |
| `ALIYUN_OSS_ACCESS_KEY_ID`     | 阿里云OSS AccessKey ID     |
| `ALIYUN_OSS_ACCESS_KEY_SECRET` | 阿里云OSS AccessKey Secret |
| `ALIYUN_OSS_BUCKET`            | 阿里云OSS Bucket名称       |
| `ALIYUN_OSS_REGION`            | 阿里云OSS区域              |

## 使用方法

1. 复制配置模板：

   ```bash
   # 在 apps/server 目录下创建 .env.local 文件
   cp docs/ENVIRONMENT-VARIABLES.md apps/server/.env.local
   ```

2. 编辑 `.env.local` 文件，填入实际值

3. 确保 `.env.local` 已添加到 `.gitignore`（默认已包含）

## 注意事项

- ⚠️ **永远不要**将 `.env.local` 提交到Git仓库
- ⚠️ 生产环境的 `JWT_SECRET` 必须使用强随机字符串
- ⚠️ 数据库密码不要使用弱口令
- ✅ 每个开发者应有自己的本地 `.env.local` 文件
- ✅ CI/CD环境中通过平台配置注入环境变量

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

Prisma CLI 在执行迁移时仍需要 `DATABASE_URL`。该值由部署环境或执行脚本根据独立的 `DB_*` 变量生成；业务代码不得自行拼接连接字符串。
