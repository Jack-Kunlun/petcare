# PetCare 部署指南

本文档是 PetCare 本地运行、诊断和生产运维的标准入口。生产发布只有一个受支持路径：
先运行 `scripts/server-init.sh`，再从 GitHub Actions 手动触发 `deploy.yml`；完整操作见
[GitHub Actions 手动发布指南](./github-actions-deploy.md)。

个人版首次启动、无外部供应商账号的演示和隔离纵向验收优先使用
[个人版本地启动与演示指南](./local-personal-demo.md)。

生产服务器是无源码运行节点：Compose 项目名固定为 `petcare`。Server、Admin、Website 在 GitHub-hosted runner 构建为
不可变镜像产物，经专用部署 runner 传输后由服务器直接加载；PostgreSQL、Redis 和 Nginx 从私有 TCR 拉取。服务器不会构建
镜像或获取仓库。

## 1. 运行模式

| 模式         | Admin           | 官网                | Server         | PostgreSQL / Redis | 适用场景            |
| ------------ | --------------- | ------------------- | -------------- | ------------------ | ------------------- |
| 本地混合开发 | 宿主机 `8986`   | Astro 开发服务      | 宿主机 `3000`  | Docker 容器        | 日常开发、调试、E2E |
| 全容器运行   | 容器映射 `8986` | 独立网关映射 `8080` | 仅 Docker 内网 | Docker 容器        | 可丢弃的本地诊断    |

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

微信配置必须同时留空或同时提供 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。公开媒体由
`PUBLIC_MEDIA_STORAGE_PROVIDER` 显式选择：生产默认 `disabled`，仅在选择 `tencent-cos` 时要求同时提供
`TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`（`BucketName-APPID`）和
`TENCENT_COS_REGION`（例如 `ap-guangzhou`）；可选 `TENCENT_COS_PUBLIC_BASE_URL` 必须是绝对 HTTP(S) URL。
开发专用的 `local` provider 在生产环境会被启动校验拒绝。详细规则参见[环境变量配置指南](../environment-variables.md)。

生产环境使用公开读、私有写 COS Bucket，并向 Server 注入仅允许读写
`public/admin-avatars/`、`public/user-avatars/`、`public/website-media/`、`public/community-media/` 与
`public/pet-media/` 前缀的最小权限子账号凭据。公开媒体凭据保存在 GitHub `production` Environment Secrets，非敏感
坐标保存在同一 Environment Variables；Server/全量发布将它们原子同步到 root-owned `0600` 的生产根 `.env`。
不要把 COS 凭据硬编码进工作流、镜像、客户端或仓库的 `.env`；生产根 `.env` 不提交。

需要在尚未正式发版的环境全量重置数据时，手动运行“手动生产发布”，选择 `target=all`，并在
`reset_data_confirmation` 输入 `RESET_PRODUCTION_DATA`。发布会先停止 Server 写入，将 PostgreSQL 备份上传到
备份 COS，再重建数据库 Schema、重新写入默认管理员/RBAC/官网默认内容并清空 Redis。该操作会删除全部用户、
宠物、社区、订单、审计及运营内容；不能与 `initialize_data` 同时使用。

### 3.1 生产 Aliyun 短信认证

首次部署前，必须开通号码认证服务的短信认证功能，并在短信认证参数配置中选择当前可用的系统赠送签名及与其配套的
系统赠送模板；登录/注册模板 Code 为 `100001`。生产环境固定调用 `SendSmsVerifyCode` 并连接
`dypnsapi.aliyuncs.com`，同时要求上面的四个 `ALIYUN_SMS_*` 变量。Server 直接传入业务侧生成的验证码，
模板参数为 `code`、`min`，有效期使用 `SMS_CODE_TTL_SECONDS`。`SMS_DEV_CODE` 在生产环境禁止配置。
服务商拒绝请求或发生通信失败时，接口只返回经脱敏的
`503 SMS_DELIVERY_FAILED`，不会暴露厂商错误详情。

为 Server 创建专用 RAM 身份，并附加自定义最小权限策略；只允许发送短信，不要授予
`AliyunDypnsFullAccess`：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dypns:SendSmsVerifyCode",
      "Resource": "*"
    }
  ]
}
```

真实 AccessKey 值只保存在生产服务器根拥有者持有、权限为 `0600` 的根 `.env` 中；不得进入 Git、镜像、
日志、文档示例或聊天。部署和排障时不得读取、复制或回传 `.env`、证书/私钥内容或真实凭据。官方核验资料：
[SendSmsVerifyCode API](https://help.aliyun.com/zh/pnvs/developer-reference/api-dypnsapi-2017-05-25-sendsmsverifycode) 与
[短信认证服务](https://help.aliyun.com/zh/pnvs/user-guide/sms-authentication-service)。

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
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env ps
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
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
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

## 5. 全容器本地诊断（非生产发布路径）

生产服务器不在本地构建镜像，也不通过本节命令发布；使用 `deploy.yml`。本节的 HTTP 或宿主机端口仅可用于可丢弃的
本地诊断，不能作为生产访问方式。

### 5.1 启动前校验

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env config --quiet
```

该命令必须成功后才能构建。不要把 `.env.example` 的占位密钥直接用于生产。

### 5.2 构建基础设施与应用镜像

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env build server admin website
```

### 5.3 在 Server 镜像中初始化

Server 运行镜像保留 Prisma CLI、Schema 与 seed 所需源码。空数据库初始化和每次生产 Schema 发布执行：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env run --rm server pnpm --filter @petcare/server prisma:migrate:deploy
# 仅在需要首次基础数据时显式执行
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env run --rm server pnpm --filter @petcare/server prisma:seed
```

### 5.4 启动应用

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d server admin website website-gateway
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env ps
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

- 生产 DNS、TLS 证书续期、WAF/CDN 域名绑定由外部控制面维护。`deploy.yml` 只从受保护的 GitHub `production`
  Environment 临时取用 Base64 证书并原子安装到 root-owned `/opt/petcare/certs`；私钥不进入 Git、镜像或 Docker
  构建上下文。
- `WEBSITE_PUBLIC_URL` 必须是最终 HTTPS 官网地址，边缘网关将 `X-Forwarded-Proto` 和主机名传给 SSR。边缘网关是唯一
  公网入口，HTTP 80 只重定向到 HTTPS 443。
- CDN 仅缓存带版本的静态资源和 `TENCENT_COS_PUBLIC_BASE_URL` 下的公开素材，不缓存 SSR HTML 或预览响应。
- COS `SecretId`、`SecretKey` 只通过受控生产配置注入 Server，绝不写入 Dockerfile、构建参数、镜像或浏览器变量。
  公开素材地址使用 `TENCENT_COS_PUBLIC_BASE_URL`，不把 COS 管理凭据暴露给客户端。

### 5.7 生产手动发布

`deploy.yml` 接受分支、标签或 commit SHA/ref，并在构建/发布前将其解析为不可变 40 字符完整 SHA。所选提交必须既通过
`ci.yml`，又携带内容严格为单行 `source-free-public-media-v2` 的 `deploy/production-release-contract`；否则 `resolve` 会在镜像工作前拒绝它。GitHub
`production` Environment 使用 `TCR_REGISTRY=ccr.ccs.tencentyun.com` 和已选的 `TCR_NAMESPACE`；`TCR_PUSH_*` 只供固定运行时
镜像同步使用，`TCR_PULL_*` 只供生产服务器拉取运行时镜像。
这些 Registry 用户名和密码不是 CAM `SecretId`/`SecretKey`，真实值不能写入文档、命令示例或日志。

TCR 命名空间必须预先拥有三个私有运行时仓库：`postgres`、`redis`、`nginx`。固定运行时镜像先由 Actions 同步到 TCR，
生产服务器不从公共镜像仓库拉取。应用镜像使用不可变完整 SHA 标签，在 GitHub-hosted runner 打包为保留 1 天的不可变
Actions Artifact；专用部署 runner 校验下载摘要与 gzip，再通过已验证的 SSH 主机传输。服务器在切换 release 前执行
`docker image load` 并核对完整镜像名，不需要 TCR 中存在应用镜像清单。

首次发布使用 `target=all`、`initialize_data=true`；日常完整发布使用 `target=all`、`initialize_data=false`；只发布一个应用时选择
`server`、`admin` 或 `website` 且保持 `false`。每个应用有独立不可变镜像标签，并在完整验证后原子更新
`/opt/petcare/.deploy-images.env`。

Server/全量发布还会从 `production` Environment 读取 `PUBLIC_MEDIA_STORAGE_PROVIDER` 与五个 `TENCENT_COS_*` 值，先在
runner 的 `0600` 临时文件中验证，再由生产发布脚本只替换 `/opt/petcare/.env` 中对应的六个键。更新失败或后续发布失败时，
发布事务先恢复旧 `.env` 再尝试镜像回滚；Admin/Website 选择性发布不改动这些 Server 运行配置。

`/opt/petcare/current` 指向不可变 release；`.env`、`.deploy-images.env`、`certs`、`logs` 和 PostgreSQL/Redis named volumes 都在
release 之外持久保存。发布归档顶层白名单只有 `docker-compose.yml`、`docker/`、`scripts/`、`deploy/`，不会覆盖这些持久数据。
TCR 密码只在需要同步或拉取固定运行时镜像的 runner 和远端本次临时目录使用，并仅通过 `--password-stdin` 写入临时 Docker
config；无论成败都立即清理。应用镜像产物不包含这些凭据。
首次初始化只传输并运行 `scripts/server-init.sh`：它使用服务器已配置的 Ubuntu APT 源，要求 `docker compose version` 成功，
创建持久目录和 `.env`，不获取仓库也不启动应用。

Server 发布先运行备份，随后在一次性容器中直接调用镜像内的 Prisma CLI 执行 forward-only migration；生产迁移与 seed 不调用
pnpm，也不访问 npm。应用镜像可尝试回滚，但数据库 migration 不会自动回滚。发布会用
`docker compose --wait --wait-timeout 180` 等待服务，并验证三个域名的 HTTP → HTTPS 重定向及四个公开
HTTPS smoke check：官网根域、`www`、Admin 和 `/api/ready`。Miniapp 始终由独立的 GitHub Actions 工作流上传微信，
不进入 Docker、TCR 或生产服务器。完整的 Environment Secret、证书上传和部署账号约束见
[GitHub Actions 手动发布指南](./github-actions-deploy.md)。

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

### 8.1 数据库异地备份（仅 Linux 生产服务器）

首次成功的主生产发布从当前不可变 release 安装备份 unit：`petcare-backup.service` 每次调用
`/opt/petcare/current/scripts/database-backup.sh`，timer 每日 `03:17 Asia/Shanghai`、随机延迟最多 30 分钟。
`scripts/server-init.sh` 不安装 unit，也不启用或启动 timer；首次成功发布会先原子写入
`/etc/petcare-backup.env`（`root` 所有、`0600`），再启用 timer。

以下步骤只能在 Linux/systemd 生产服务器执行。本地尚未实际运行 Bash、systemd、Docker、PostgreSQL 或 COS
备份/恢复，不能把静态脚本和 unit 安装当作真实运行验证。

#### COS 控制台前置配置

为备份创建独立的 COS Bucket 与专用 CAM 子账号/密钥：

- Bucket ACL 必须为**私有读写**，访问仅使用 HTTPS。
- 上传代码会请求 SSE-COS 的 `AES256` 服务端加密；每个对象都应在 COS 元数据中显示该加密状态。
- CAM 只授予 `name/cos:PutObject` 和 `name/cos:GetObject`，资源仅限已选 Bucket 的 `postgresql/*` 前缀。
  不授予 `cos:*`、资源 `*`、列举、删除或管理权限。
- 生命周期规则的前缀为 `postgresql/`，对象在 30 天后删除。启用版本控制时，还必须同步处理 noncurrent versions
  与 delete markers，避免旧版本绕过 30 天保留期。

腾讯云官方资料：[最小权限](https://cloud.tencent.com/document/product/436/38618)、
[访问控制和默认私有](https://cloud.tencent.com/document/product/436/30749)、
[生命周期](https://cloud.tencent.com/document/product/436/56548) 与
[服务端加密](https://cloud.tencent.com/document/product/436/121732)。

备份凭据只允许通过 GitHub `production` Environment 的同名 Secrets 写入服务器专用文件；变量名、文件边界和
禁止存放位置见[环境变量配置指南](../environment-variables.md)。

#### 排程、手动备份与 COS 核验

```bash
# Verify scheduling
systemctl status petcare-backup.timer
systemctl list-timers petcare-backup.timer

# Run and inspect one backup
systemctl start petcare-backup.service
journalctl -u petcare-backup.service --since today
```

服务成功退出和 journal 仅是初步证据。到 COS 控制台核对该次对象的显式 object key、非零 size、时间是否对应
UTC 时间戳，以及服务端加密是否为 SSE-COS/AES256。还必须配置外部监控在 `petcare-backup.service` 失败时告警；
journal 本身不会通知操作员。

#### 仅临时库的恢复演练

恢复必须指定一个已核对过的对象 key，不能按“最新”或列举结果自动选择：

```bash
# Restore one selected object into a temporary database
/opt/petcare/current/scripts/database-restore.sh postgresql/petcare-public/2026/08/petcare-public-20260820T010203Z.dump
```

脚本只创建并验证 `petcare_restore_<UTC timestamp>` 临时数据库，完成后删除它；不会修改生产数据库。恢复生产库是
独立的人工授权、维护窗口操作，自动脚本永远不执行。

#### 轮换、保留期与清单

轮换 CAM 密钥时，先在 GitHub `production` Environment 更新四个 `BACKUP_COS_*` Secrets（或换用新的
专用 CAM key），随后通过后续主生产部署原子重写 `0600` 的服务器文件。手动运行一次 backup 并在 COS 核验对象后，
才禁用旧 key。若新 key 或验证失败，保留旧 key，并通过受控 Secret 管理恢复原先四项后重新部署；不得把旧值写回
Git、根 `.env`、镜像、日志或聊天。

将以下项目纳入上线后和定期恢复演练清单：30 天 `postgresql/` 生命周期（含版本控制时的非当前版本/delete
markers）、timer 的下一次执行、手动备份的 COS 元数据、显式 key 的临时库恢复，以及 service 失败的外部告警。

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

- 使用部署平台或 Secret Manager 注入敏感值；Aliyun AccessKey 除外，必须遵守下方的专用根 `.env` 规则；
- 数据库与 Redis 不暴露到公网；
- 使用 HTTPS 和明确的 CORS 白名单；
- DNS、TLS、CDN 和 WAF 在边缘层维护，禁止给官网 HTML 或草稿预览配置共享缓存；
- 只向 Server 注入腾讯云 COS 凭据，使用 `TENCENT_COS_PUBLIC_BASE_URL` 提供公开素材；
- 禁用 `SMS_DEV_CODE`；生产短信认证使用专用 RAM 身份和仅含 `dypns:SendSmsVerifyCode` 的自定义策略，不使用 `AliyunDypnsFullAccess`；
- Aliyun AccessKey 只保存在 root-owned、`0600` 的生产根 `.env`，不进入 Git、镜像、日志、文档示例或聊天；
- TCR pull 密码只存在本次 runner/远端临时目录和临时 Docker config；在首次发布、第二次发布、回退演练和备份/恢复演练
  均验收前，保留旧 `GHCR_PULL_USER`、`GHCR_PULL_TOKEN` 与服务器 GitHub Deploy Key；
- 只有验收后才执行破坏性迁移清理：从 GitHub 仓库删除旧 Deploy Key 和两个旧 GHCR Environment Secrets；在服务器只删除
  `/root/.ssh/petcare-readonly`、`/root/.ssh/petcare-readonly.pub`；先确认 `/root/.ssh/known_hosts` 仍为 GitHub 专用文件才可删除整个文件，
  混合或无法确认时只用 `ssh-keygen -R` 移除 `github.com`/`ssh.github.com` 并保留无关主机；只删除 `/opt/petcare/.git`，随后运行
  `sudo test ! -e /opt/petcare/.git`；不得打印凭据、提前清理或广泛删除 `/root/.ssh`、`/opt/petcare`；
- 清理后以 `target=admin` 或 `target=website`、`initialize_data=false` 执行一次不涉及数据库的选择性发布；
- 定期轮换数据库、Redis、JWT 和管理员密码；
- 启动前执行 `docker compose config --quiet`；
- 只部署通过完整 CI 且携带当前 `deploy/production-release-contract` 标记的已保存版本或提交。

相关文档：

- [环境变量配置指南](../environment-variables.md)
- [安全审计报告](../../SECURITY-AUDIT.md)
- [安全检查清单](../../SECURITY-CHECKLIST.md)
