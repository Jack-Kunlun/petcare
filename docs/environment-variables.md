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

| 变量名                         | 必填     | 默认值  | 说明                                                          |
| ------------------------------ | -------- | ------- | ------------------------------------------------------------- |
| `DEFAULT_ADMIN_USERNAME`       | ✅       | `admin` | 初始管理员账号                                                |
| `DEFAULT_ADMIN_PHONE`          | ✅       | -       | 初始管理员手机号                                              |
| `DEFAULT_ADMIN_PASSWORD`       | ✅       | -       | 初始管理员密码，至少 12 位                                    |
| `SMS_DEV_CODE`                 | 否       | -       | 仅限本地固定 6 位验证码；生产环境禁止配置                     |
| `ALIYUN_SMS_ACCESS_KEY_ID`     | 生产必填 | -       | 短信认证专用 RAM AccessKey ID；仅生产根 `.env` 保存真实值     |
| `ALIYUN_SMS_ACCESS_KEY_SECRET` | 生产必填 | -       | 短信认证专用 RAM AccessKey Secret；仅生产根 `.env` 保存真实值 |
| `ALIYUN_SMS_SIGN_NAME`         | 生产必填 | -       | 号码认证控制台当前可用的系统赠送签名                          |
| `ALIYUN_SMS_TEMPLATE_CODE`     | 生产必填 | -       | 与赠送签名配套的系统赠送模板 Code（登录/注册为 `100001`）     |
| `SMS_CODE_TTL_SECONDS`         | 否       | `300`   | 验证码有效期                                                  |
| `SMS_SEND_COOLDOWN_SECONDS`    | 否       | `60`    | 同一手机号发送冷却时间                                        |
| `SMS_HOURLY_LIMIT`             | 否       | `5`     | 同一手机号每小时发送上限                                      |
| `SMS_MAX_ATTEMPTS`             | 否       | `5`     | 单个验证码最大校验失败次数                                    |
| `CAPTCHA_TTL_SECONDS`          | 否       | `300`   | 图形验证码有效期，必须为正整数                                |
| `CAPTCHA_MAX_ATTEMPTS`         | 否       | `5`     | 图形验证码最大校验失败次数                                    |
| `AUTH_PASSWORD_MAX_ATTEMPTS`   | 否       | `5`     | 密码登录固定窗口允许次数                                      |
| `AUTH_PASSWORD_WINDOW_SECONDS` | 否       | `900`   | 密码登录固定窗口秒数                                          |

开发环境可设置 `SMS_DEV_CODE=246810` 进行本地联调。接口不会把验证码返回给前端；生产环境必须接入
阿里云号码认证服务，并禁止配置该变量。生产环境固定使用 `SendSmsVerifyCode` 和端点
`dypnsapi.aliyuncs.com`，四个 `ALIYUN_SMS_*` 变量缺一不可。Server 将业务侧生成的验证码和现有
`SMS_CODE_TTL_SECONDS` 映射为模板参数 `code`、`min` 及接口 `ValidTime`。
服务商拒绝请求或通信失败时，接口只返回经脱敏的 `503 SMS_DELIVERY_FAILED`，不会暴露厂商详情。

真实 Aliyun AccessKey 值只保存在生产服务器 `root-owned`、权限为 `0600` 的根 `.env` 中；不得进入 Git、
镜像、日志、文档示例或聊天。不得读取、复制或回传 `.env`、证书/私钥内容或真实凭据。

### 生产初始化值

`scripts/server-init.sh` 只在生产服务器生成 `/opt/petcare/.env`，并将其设置为 root-owned `0600`。它不生成
`SERVER_IP`，也不会写入 `EXPOSE_DB_PORT` 或 `EXPOSE_REDIS_PORT`；这两个变量只属于本地
`docker-compose.dev.yml` 覆盖。初始值为：

```dotenv
API_BASE_URL=https://admin.petcare-home.com/api
ALLOWED_ORIGINS=https://admin.petcare-home.com
WEBSITE_PUBLIC_URL=https://petcare-home.com
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WECHAT_APP_ID=wx3bdad4ab652f0d1d
WECHAT_APP_SECRET=
ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
```

`DEFAULT_ADMIN_PHONE` 由初始化命令显式提供并按中国大陆手机号校验；随机初始管理员密码绝不输出。root 必须通过安全
终端补全上述空值并轮换初始管理员密码，然后才可进行第一次生产发布。

发送短信验证码之前必须先通过图形验证码。图形验证码由 Server 生成无文本节点的 SVG，Redis 只保存 HMAC 摘要；校验成功后立即消费，同一个挑战不能重复使用。

### API配置

| 变量名                      | 必填 | 说明                                                                 |
| --------------------------- | ---- | -------------------------------------------------------------------- |
| `API_BASE_URL`              | 否   | Admin API 基础 URL；默认值仅用于本地诊断 `http://localhost:8986/api` |
| ~~`TARO_APP_API_BASE_URL`~~ | -    | ~~Taro Miniapp 请求地址；已随项目删除~~                              |

### 第三方服务（可选）

| 变量名                        | 说明                                                  |
| ----------------------------- | ----------------------------------------------------- |
| `WECHAT_APP_ID`               | 微信小程序 AppID                                      |
| `WECHAT_APP_SECRET`           | 微信小程序 AppSecret                                  |
| `TENCENT_COS_SECRET_ID`       | 腾讯云 COS 最小权限子账号的 SecretId；仅 Server 读取  |
| `TENCENT_COS_SECRET_KEY`      | 腾讯云 COS 最小权限子账号的 SecretKey；仅 Server 读取 |
| `TENCENT_COS_BUCKET`          | 公开素材 Bucket，格式为 `BucketName-APPID`            |
| `TENCENT_COS_REGION`          | COS 区域代码，例如 `ap-guangzhou`                     |
| `TENCENT_COS_PUBLIC_BASE_URL` | 可选的公开素材访问基础 URL；留空时使用 COS 默认域名   |

微信配置必须同时留空或同时提供。启用时，`WECHAT_APP_ID` 必须符合 `wx` 加 16 位字符的格式，
`WECHAT_APP_SECRET` 必须为 32 位十六进制字符串。

`scripts/server-init.sh` 生成生产 `.env` 时会预写正式 AppID `wx3bdad4ab652f0d1d`，并故意将
`WECHAT_APP_SECRET` 留空；这是未完成的初始化状态。root 必须在第一次 `deploy.yml` 前安全填写它，否则 Server 会按
成组配置规则拒绝启动。

~~Miniapp 只读取 `TARO_APP_API_BASE_URL`，并从 `apps/miniapp/project.config.json` 取得公开 AppID。~~

`WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 只由 Server 使用，任何客户端都不得包含或读取 AppSecret。Miniapp 的业务请求边界尚未迁移，相关客户端变量将在实际接入时另行确定。

腾讯云 COS 采用三态配置：

- `TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION` 和
  `TENCENT_COS_PUBLIC_BASE_URL` 都为空时，禁用管理员公开头像和官网素材上传；其他功能仍可用，上传接口返回
  `503 STORAGE_UNAVAILABLE`。
- 前四项中任一项已配置但未完整提供，或只有 `TENCENT_COS_PUBLIC_BASE_URL` 被配置时，Server 会在监听端口前启动失败。
- 前四项完整提供时启用 COS；`TENCENT_COS_PUBLIC_BASE_URL` 可选，若提供必须是绝对 HTTP(S) URL。

生产环境应使用公开读、私有写素材 Bucket，并为 Server 配置仅能操作该 Bucket 中
`public/admin-avatars/` 和 `public/website-media/` 前缀的最小权限子账号凭据。不要将 SecretId、SecretKey 或根账号凭据写入客户端、仓库或
文档示例；任何根 `.env` 均不提交，生产文件仅由 root 在服务器上持有。

### 数据库异地备份（仅生产 Linux/systemd）

数据库备份使用独立于公开素材 COS 的专用 Bucket 和以下四个变量；它们不是根 `.env`、Docker Compose 或 Server
启动配置，只由备份/恢复脚本读取：

```dotenv
BACKUP_COS_SECRET_ID=
BACKUP_COS_SECRET_KEY=
BACKUP_COS_BUCKET=
BACKUP_COS_REGION=
```

真实值仅保存在 GitHub `production` Environment 的同名 Secrets，并由主生产部署原子写入
`/etc/petcare-backup.env`。该文件必须由 `root` 持有、权限为 `0600`。不得将任一值存入 Git、GitHub
Variables、根 `.env`、镜像、日志或聊天；也不得为备份向应用 `TENCENT_COS_*` 变量复用公开素材 Bucket。

完整的 COS 权限、生命周期、轮换、定时任务和恢复步骤见
[部署指南的数据库异地备份运行手册](08-deployment/deployment.md)。

### 官网内容运行时配置

| 变量名                              | 必填 | 默认值                  | 说明                                                |
| ----------------------------------- | ---- | ----------------------- | --------------------------------------------------- |
| `WEBSITE_PUBLIC_URL`                | 否   | `http://localhost:8080` | 官网公开地址，必须为绝对 HTTP(S) URL                |
| `WEBSITE_CONTENT_API_BASE_URL`      | 否   | `http://server:3000`    | 仅 Astro SSR 使用的 Nest 公共内容 API 内网地址      |
| `WEBSITE_PREVIEW_TTL_SECONDS`       | 否   | `600`                   | 草稿预览令牌有效期（秒），必须为正整数              |
| `WEBSITE_CONTENT_CACHE_TTL_SECONDS` | 否   | `86400`                 | 已发布官网内容 Redis 缓存有效期（秒），必须为正整数 |
| `WEBSITE_LAST_SUCCESS_TTL_SECONDS`  | 否   | `300`                   | Astro SSR 上次成功发布快照的故障回退窗口（秒）      |
| `WEBSITE_PORT`                      | 否   | `8080`                  | 官网独立 Nginx 网关映射到宿主机的端口               |

`WEBSITE_CONTENT_API_BASE_URL` 仅注入 `website` 容器，不得使用 `PUBLIC_` 前缀，也不得出现在浏览器
JavaScript、构建参数或 CDN 配置中。Astro 通过它在 Docker 内网调用 Nest 的已发布内容和课堂文章接口；草稿预览
同样由 Astro 服务端在内网读取，预览令牌不会经过公网 Nginx 网关。

`WEBSITE_LAST_SUCCESS_TTL_SECONDS` 是官网 SSR 在 Nest 或 Redis 短暂不可用时可展示上次成功发布快照的最大时长；
超过该窗口必须返回故障页面，不能把旧内容伪装成最新发布。`WEBSITE_PORT` 只影响 `website-gateway` 的宿主机
映射，不改变 Astro 容器内部固定的 `4321` 端口。

## 使用方法

1. 在仓库根目录复制配置模板：

   ```bash
   cp .env.example .env
   ```

2. 编辑根目录 `.env`，填入本地数据库、Redis、JWT 和默认管理员配置。

3. 启动基础设施并初始化：

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
   # 空数据库初始化，以及之后每次生产 Schema 发布
   pnpm --filter @petcare/server prisma:migrate:deploy
   # 仅在需要首次基础数据时显式执行
   pnpm --filter @petcare/server prisma:seed
   ```

   `prisma:push` 仅可用于可丢弃的本地 Schema 实验，绝不属于部署流程。

4. ~~启动 Server 和 Taro Miniapp 微信端监听构建：~~

   ```bash
   pnpm dev:server
   # pnpm dev:miniapp（已删除）
   ```

5. ~~在微信开发者工具中导入 `apps/miniapp`，并通过 `TARO_APP_API_BASE_URL` 配置请求地址。~~

   原 Taro 联调流程已弃用；Miniapp 业务请求尚未迁移，不沿用旧变量和旧项目配置。

## 注意事项

- ⚠️ **永远不要**将根目录 `.env` 提交到 Git 仓库
- ⚠️ 生产环境的 `JWT_SECRET` 必须使用强随机字符串
- ⚠️ 生产环境必须设置独立的 `DB_PASSWORD`、`REDIS_PASSWORD` 和默认管理员密码
- ⚠️ 生产环境不得设置 `SMS_DEV_CODE`
- ⚠️ 生产 Aliyun SMS 必须配置四个 `ALIYUN_SMS_*` 变量；AccessKey 真实值仅保存在 root-owned、`0600` 的根 `.env`
- ⚠️ 数据库密码不要使用弱口令
- ✅ 每个开发者应有自己的本地根 `.env`
- ✅ CI/CD 环境只注入隔离测试凭据；生产 Aliyun AccessKey 只保存在 `root-owned`、`0600` 的根 `.env`

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
