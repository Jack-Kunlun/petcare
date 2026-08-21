# PetCare 部署指南

本文档是 PetCare 本地运行与 Docker Compose 部署的唯一标准入口。

## 1. 运行模式

| 模式         | Admin           | 官网                | Server         | PostgreSQL / Redis | 适用场景            |
| ------------ | --------------- | ------------------- | -------------- | ------------------ | ------------------- |
| 本地混合开发 | 宿主机 `8986`   | Astro 开发服务      | 宿主机 `3000`  | Docker 容器        | 日常开发、调试、E2E |
| 全容器运行   | 容器映射 `8986` | 独立网关映射 `8080` | 仅 Docker 内网 | Docker 容器        | 集成验证、部署演练  |

端口约定：

- Admin：`http://localhost:8986`
- 官网：`http://localhost:8080`
- Server：本地混合开发为 `http://localhost:3000`；全容器运行仅 Docker 内网可达
- Swagger：仅宿主机非生产模式的 `http://localhost:3000/api-docs`
- 进程存活检查：本地混合开发为 `http://localhost:3000/health`；容器内为 `http://server:3000/health`
- 流量就绪检查：本地混合开发为 `http://localhost:3000/ready`；容器内为 `http://server:3000/ready`

| Endpoint  | Meaning               | Dependencies                    |
| --------- | --------------------- | ------------------------------- |
| `/health` | Nest process liveness | None                            |
| `/ready`  | Traffic readiness     | PostgreSQL query + Redis `PING` |

## 2. 前置要求

- Node.js 24.19.x，最低支持 24.12.0
- pnpm 11.x，项目锁定 `pnpm@11.15.1`
- Docker 与 Docker Compose v2
- Windows、macOS 或 Linux

验证并启用 Corepack：

```bash
node --version
corepack --version
corepack enable
corepack install
pnpm --version
docker --version
docker compose version
```

`package.json#packageManager` 是 pnpm 版本的唯一项目级来源。如果开发者本机安装的
pnpm 版本不同，pnpm 会自动下载并使用项目声明的版本。

## 3. 环境变量

本地统一使用仓库根目录 `.env`：

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

必须替换以下敏感值：

- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`，至少 32 位
- `DEFAULT_ADMIN_PHONE`
- `DEFAULT_ADMIN_PASSWORD`，至少 12 位
- `ALIYUN_SMS_ACCESS_KEY_ID`
- `ALIYUN_SMS_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_TEMPLATE_CODE`

生产 Docker 缺少任一上述变量都会在 Compose 解析或 Server 启动阶段失败。生产环境不得设置
`SMS_DEV_CODE`；Compose 会强制覆盖为空。

微信配置必须同时留空或同时提供 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。腾讯云 COS 配置的
`TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`（`BucketName-APPID`）和
`TENCENT_COS_REGION`（例如 `ap-guangzhou`）必须同时提供或同时留空；可选
`TENCENT_COS_PUBLIC_BASE_URL` 只能在前四项完整时设置。五项均为空时禁用管理员头像与官网素材上传，其他功能
仍可用；任一不完整组合会使 Server 在监听端口前退出。详细规则参见[环境变量配置指南](../environment-variables.md)。

生产环境使用公开读、私有写 COS Bucket，并向 Server 注入仅允许读写
`public/admin-avatars/` 与 `public/website-media/` 前缀的最小权限子账号凭据。不要将 COS 凭据写入镜像、工作流、客户端或仓库的 `.env`；
根 `.env` 不提交。

### 3.1 生产 Aliyun SMS

首次部署前，必须在阿里云审批通过短信签名和验证码模板；模板使用 `${code}`。生产环境固定连接
`dysmsapi.aliyuncs.com`，并要求上面的四个 `ALIYUN_SMS_*` 变量。模板参数名必须严格为 `code`。
`SMS_DEV_CODE` 在生产环境禁止配置。短信服务商拒绝请求或发生通信失败时，接口只返回经脱敏的
`503 SMS_DELIVERY_FAILED`，不会暴露厂商错误详情。

为 Server 创建专用 RAM 身份，并附加自定义最小权限策略；只允许发送短信，不要授予
`AliyunDysmsFullAccess`：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dysms:SendSms",
      "Resource": "*"
    }
  ]
}
```

真实 AccessKey 值只保存在生产服务器根拥有者持有、权限为 `0600` 的根 `.env` 中；不得进入 Git、镜像、
日志、文档示例或聊天。部署和排障时不得读取、复制或回传 `.env`、证书/私钥内容或真实凭据。官方核验资料：
[SendSms API](https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms) 与
[RAM 身份管理](https://help.aliyun.com/zh/sms/identity-management)。

官网运行时变量中，`WEBSITE_CONTENT_API_BASE_URL` 仅供 Astro SSR 容器走 Docker 内网访问 Nest，绝不作为浏览器
变量或镜像构建参数。`WEBSITE_PUBLIC_URL`、`WEBSITE_PORT` 和 `WEBSITE_LAST_SUCCESS_TTL_SECONDS` 分别定义公网
源地址、网关端口和最多五分钟的上次成功快照回退窗口。

## 4. 本地混合开发

### 4.1 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 4.2 启动基础设施

```bash
docker compose up -d postgres redis
docker compose ps
```

根 `.env` 应使用：

```dotenv
DB_HOST=localhost
REDIS_HOST=localhost
EXPOSE_DB_PORT=5432
EXPOSE_REDIS_PORT=6379
```

### 4.3 初始化数据库

空数据库初始化，以及之后每次生产 Schema 发布，都使用已提交的 Prisma Migrate 迁移：

```bash
# 空数据库初始化和每次生产 Schema 发布
pnpm --filter @petcare/server prisma:migrate:deploy
# 仅在需要首次基础数据时显式执行
pnpm --filter @petcare/server prisma:seed
```

`prisma:push` 仅可用于可丢弃的本地 Schema 实验，绝不属于部署流程。重复种子不会覆盖已有管理员的
账号、昵称、密码或状态，也会保留官网草稿/已发布版本指针和系统设置的已发布版本指针；平台权限目录及其关联
允许按当前目录同步。

### 4.4 启动应用

```bash
pnpm dev
```

也可以单独启动：

```bash
pnpm dev:admin
pnpm dev:server
pnpm --filter @petcare/website dev
pnpm dev:miniapp:mp-weixin
```

~~旧命令：`pnpm dev:miniapp`~~

### 4.5 日常启动

首次初始化后，日常开发只需：

```bash
docker compose --env-file .env up -d postgres redis
pnpm dev
```

### 4.6 升级 pnpm

由维护者显式升级并验证：

```bash
corepack use pnpm@<目标版本>
pnpm install
pnpm check
```

`corepack use` 会更新根 `package.json` 的 `packageManager` 并执行安装。提交
`package.json` 和 `pnpm-lock.yaml` 前应审查实际变化。CI 和 Docker 均从
`packageManager` 读取 pnpm 版本，无需在其他文件重复修改。

## 5. 全容器运行

### 5.1 启动前校验

```bash
docker compose config --quiet
```

该命令必须成功后才能构建。不要把 `.env.example` 的占位密钥直接用于生产。

### 5.2 构建基础设施与应用镜像

```bash
docker compose up -d postgres redis
docker compose build server admin website
```

### 5.3 在 Server 镜像中初始化

Server 运行镜像保留 Prisma CLI、Schema 与 seed 所需源码。空数据库初始化和每次生产 Schema 发布执行：

```bash
docker compose run --rm server pnpm --filter @petcare/server prisma:migrate:deploy
# 仅在需要首次基础数据时显式执行
docker compose run --rm server pnpm --filter @petcare/server prisma:seed
```

### 5.4 启动应用

```bash
docker compose up -d server admin website website-gateway
docker compose ps
```

容器中的 Server 固定为 `NODE_ENV=production`，因此不提供 Swagger UI。

官网 `website` 是非 root 的 Astro standalone SSR 容器，只在 `petcare-network` 内部监听 `4321`，健康检查为
`GET /healthz`。`website-gateway` 是独立 Nginx 公网入口，发布 `${WEBSITE_PORT:-8080}:80`，不会替换或复用
Admin 的静态 Nginx 容器。网关仅代理官网页面、`/website-content/*` 的已发布读取，以及
`/content/articles/*` 的公开课堂读取；不代理 `/admin/*`、`/api-docs` 或预览 API。全容器模式不会直接向宿主机
映射 Nest `3000`，从而不能绕过官网网关的公开路由白名单。

### 5.5 官网发布、缓存与回滚

页面 HTML 由 Astro 按请求 SSR，公网 CDN 不得配置 HTML TTL，以免掩盖一次显式发布。发布事务提交后，新请求读取
新的已发布版本指针；因此不需要等待旧缓存失效。静态资源和 COS 公开素材可由 CDN 按各自版本化 URL 缓存。

当 Nest 或 Redis 短暂不可用时，官网最多使用 `WEBSITE_LAST_SUCCESS_TTL_SECONDS=300` 秒内的上次成功发布快照；
超过五分钟返回官网故障页。这个回退不适用于草稿预览，预览仍为私有、`no-store` 的服务端读取。

回滚操作在 Admin 的官网内容历史中选择目标修订执行“恢复为草稿”，核对差异后显式发布。恢复草稿本身不会改变线上
页面；只有新的显式发布才会切换公开版本。

### 5.6 DNS、TLS、CDN 与 COS 责任边界

- DNS、TLS 证书续期、WAF/CDN 域名绑定由部署平台或边缘基础设施负责，Compose 不申请证书，也不保存私钥；
- `WEBSITE_PUBLIC_URL` 必须设为最终 HTTPS 官网地址，反向代理把 `X-Forwarded-Proto` 和主机名传给 SSR；
- CDN 仅缓存带版本的静态资源和 `TENCENT_COS_PUBLIC_BASE_URL` 下的公开素材，不缓存 SSR HTML 或预览响应；
- COS `SecretId`、`SecretKey` 只通过部署平台的 Secret Manager 注入 Server，绝不写入 Dockerfile、构建参数、镜像或
  浏览器变量。公开素材地址使用 `TENCENT_COS_PUBLIC_BASE_URL`，不把 COS 管理凭据暴露给客户端。

## 6. 质量与端到端测试

完整本地门禁：

```bash
pnpm check
```

分别执行：

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

E2E 前确保 PostgreSQL、Redis 和 seed 已就绪：

```bash
pnpm test:e2e
```

该命令先验证 Server `/health` 的统一响应，再自动启动 Server `3000` 和 Admin `8986`，使用
默认管理员完成 Chromium 登录与导航测试。

## 7. CI

`.github/workflows/ci.yml` 包含：

- `quality`：Prettier、ESLint、TypeScript、中文提交信息；
- `unit-test`：工具测试与全部工作区单测；
- ~~`build`：Admin、Server、Taro Miniapp 微信端和共享包；~~
- `build`：Admin、Website SSR、Server、Miniapp H5 和共享包；
- `e2e`：PostgreSQL、Redis、连续两次 `prisma:migrate:deploy`、`prisma:migrate:status`、首次数据 seed、Server E2E、Admin Playwright；
- `docker`：仅 `master` push，在前四项通过后校验 Compose 并执行工作流中声明的容器构建；官网镜像的本地验证命令见第 5 节。

初始 migration SQL 已提交，CI 也已配置 `deploy` / `deploy` / `status`；但由于本地没有 Docker，尚未在本地
实际观察到 CI 或空数据库执行成功，不能据此宣称已经跑通。CI 只使用隔离测试凭据。真实微信、腾讯云 COS、
Aliyun AccessKey 和生产密钥不得写入工作流。

## 8. 常用运维命令

```bash
docker compose ps
docker compose logs -f server
docker compose logs -f website website-gateway
docker compose restart server
docker compose down
```

检查数据库和 Redis：

```bash
docker compose exec postgres pg_isready -U "$DB_USERNAME" -d "$DB_NAME"
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
```

停止并删除数据卷会清空本地数据库，只在确认需要重置时执行：

```bash
docker compose down -v
```

## 9. 故障排查

### Server 启动前退出

查看错误中列出的环境变量名称：

```bash
docker compose logs server
```

重点检查端口是否为正整数、JWT 密钥长度、管理员手机号与密码、CORS URL，以及微信或腾讯云 COS
字段组是否完整。

### Admin 无法访问 API

- 确认 Server `3000` 正常；
- 确认 Admin 使用 `8986`；
- 本地 Vite 通过 `/api` 代理到 `http://localhost:3000`；
- 检查 `ALLOWED_ORIGINS` 是否包含实际 Admin 来源。

### 官网返回 503 或未显示刚发布内容

- 检查 `website` 和 `website-gateway` 均通过 `/healthz`；
- 检查 `WEBSITE_CONTENT_API_BASE_URL=http://server:3000` 只注入 `website` 容器；
- 核对 Admin 中该页面是否执行了显式发布，而不只是保存草稿；
- 确认 CDN 没有缓存官网 HTML。故障回退最多展示五分钟内的上次成功发布快照，超过窗口返回 503 是预期保护行为；
- 通过历史“恢复为草稿”后必须再次显式发布，才能完成回滚。

### E2E 失败

- 重新执行 `prisma:migrate:deploy`，并在确实需要首次数据时执行 `prisma:seed`；
- 检查 `DEFAULT_ADMIN_USERNAME`、`DEFAULT_ADMIN_PASSWORD`；
- 查看 `apps/admin/playwright-report/` 和 `apps/admin/test-results/`；
- CI 失败时下载 `playwright-artifacts`。

## 10. 生产安全清单

- 使用部署平台或 Secret Manager 注入敏感值；
- 数据库与 Redis 不暴露到公网；
- 使用 HTTPS 和明确的 CORS 白名单；
- DNS、TLS、CDN 和 WAF 在边缘层维护，禁止给官网 HTML 或草稿预览配置共享缓存；
- 只向 Server 注入腾讯云 COS 凭据，使用 `TENCENT_COS_PUBLIC_BASE_URL` 提供公开素材；
- 禁用 `SMS_DEV_CODE`；生产 Aliyun SMS 使用专用 RAM 身份和仅含 `dysms:SendSms` 的自定义策略，不使用 `AliyunDysmsFullAccess`；
- Aliyun AccessKey 只保存在 root-owned、`0600` 的生产根 `.env`，不进入 Git、镜像、日志、文档示例或聊天；
- 定期轮换数据库、Redis、JWT 和管理员密码；
- 启动前执行 `docker compose config --quiet`；
- 只部署通过完整 CI 的已保存版本或提交。

相关文档：

- [环境变量配置指南](../environment-variables.md)
- [安全审计报告](../../SECURITY-AUDIT.md)
- [安全检查清单](../../SECURITY-CHECKLIST.md)
