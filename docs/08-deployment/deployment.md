# PetCare 部署指南

本文档是 PetCare 本地运行与 Docker Compose 部署的唯一标准入口。

## 1. 运行模式

| 模式         | Admin           | Server          | PostgreSQL / Redis | 适用场景            |
| ------------ | --------------- | --------------- | ------------------ | ------------------- |
| 本地混合开发 | 宿主机 `8986`   | 宿主机 `3000`   | Docker 容器        | 日常开发、调试、E2E |
| 全容器运行   | 容器映射 `8986` | 容器映射 `3000` | Docker 容器        | 集成验证、部署演练  |

端口约定：

- Admin：`http://localhost:8986`
- Server：`http://localhost:3000`
- Swagger：`http://localhost:3000/api-docs`，仅宿主机非生产模式启用
- 健康检查：`http://localhost:3000/health`

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

生产 Docker 缺少任一上述变量都会在 Compose 解析或 Server 启动阶段失败。生产环境不得设置
`SMS_DEV_CODE`；Compose 会强制覆盖为空。

微信配置必须同时留空或同时提供 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。腾讯云 COS 公开头像配置的
`TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`（`BucketName-APPID`）和
`TENCENT_COS_REGION`（例如 `ap-guangzhou`）必须同时提供或同时留空；可选
`TENCENT_COS_PUBLIC_BASE_URL` 只能在前四项完整时设置。五项均为空时仅禁用管理员头像上传，其他个人中心功能
仍可用；任一不完整组合会使 Server 在监听端口前退出。详细规则参见[环境变量配置指南](../environment-variables.md)。

生产环境为头像使用独立的公开读、私有写 COS Bucket，并向 Server 注入仅允许读写
`public/admin-avatars/` 前缀的最小权限子账号凭据。不要将 COS 凭据写入镜像、工作流、客户端或仓库的 `.env`；
根 `.env` 仅供本地使用且不提交。

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

项目处于建表初期，不使用迁移；直接同步 Schema 并执行幂等 seed：

```bash
pnpm --filter @petcare/server prisma:push
pnpm --filter @petcare/server prisma:seed
```

seed 创建或更新默认管理员、超级管理员角色和权限数据，凭据读取根 `.env`。

### 4.4 启动三端

```bash
pnpm dev
```

也可以单独启动：

```bash
pnpm dev:admin
pnpm dev:server
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

### 5.2 构建基础设施与 Server 镜像

```bash
docker compose up -d postgres redis
docker compose build server admin
```

### 5.3 在 Server 镜像中初始化

Server 运行镜像保留 Prisma CLI、Schema 与 seed 所需源码，可执行：

```bash
docker compose run --rm server pnpm --filter @petcare/server prisma:push
docker compose run --rm server pnpm --filter @petcare/server prisma:seed
```

### 5.4 启动应用

```bash
docker compose up -d server admin
docker compose ps
```

容器中的 Server 固定为 `NODE_ENV=production`，因此不提供 Swagger UI。

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
- `build`：Admin、Server、Miniapp H5 和共享包；
- `e2e`：PostgreSQL、Redis、Prisma 初始化、Server E2E、Admin Playwright；
- `docker`：仅 `master` push，在前四项通过后校验 Compose 并构建镜像。

CI 只使用隔离测试凭据。真实微信、腾讯云 COS 和生产密钥不得写入工作流。

## 8. 常用运维命令

```bash
docker compose ps
docker compose logs -f server
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

### E2E 失败

- 重新执行 `prisma:push` 与 `prisma:seed`；
- 检查 `DEFAULT_ADMIN_USERNAME`、`DEFAULT_ADMIN_PASSWORD`；
- 查看 `apps/admin/playwright-report/` 和 `apps/admin/test-results/`；
- CI 失败时下载 `playwright-artifacts`。

## 10. 生产安全清单

- 使用部署平台或 Secret Manager 注入敏感值；
- 数据库与 Redis 不暴露到公网；
- 使用 HTTPS 和明确的 CORS 白名单；
- 禁用 `SMS_DEV_CODE`；
- 定期轮换数据库、Redis、JWT 和管理员密码；
- 启动前执行 `docker compose config --quiet`；
- 只部署通过完整 CI 的已保存版本或提交。

相关文档：

- [环境变量配置指南](../environment-variables.md)
- [安全审计报告](../../SECURITY-AUDIT.md)
- [安全检查清单](../../SECURITY-CHECKLIST.md)
