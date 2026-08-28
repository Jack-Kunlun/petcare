# PetCare 个人版本地启动与演示指南

本文提供一条不依赖企业资质、真实支付、生产短信、微信生产登录或腾讯云 COS 的本地启动与验收路径。
它只覆盖当前个人、非商业原型：官网、后台内容管理、萌宠课堂、受控社区和本人宠物档案。

## 1. 能力与演示边界

- 长期本地 Compose 运行 PostgreSQL、Redis、Server、Admin、Website 和 Website 网关。
- 本地公开媒体写入 `petcare-local-media-data` named volume，通过 Website 网关的 `/media/` 只读访问。
- 基础 seed 只创建默认管理员、RBAC 权限目录和安全的官网已发布模板。
- 宠物、社区帖子、课堂文章、订单、认证和资金记录不会作为“演示数据”写入长期本地库。
- 社区与宠物档案使用真实应用进程和一次性 PostgreSQL Schema 做纵向演示；结束后自动清理。
- 普通 Miniapp 运行时仍使用真实微信登录协议。没有用户自有的微信 App ID/Secret 时，不把交互式登录包装成本地已有能力。

服务者认证、悬赏、接单、支付、退款、结算、提现和对外经营不属于本指南范围。

## 2. 首次准备

需要以下本地工具：

- Docker Desktop 或其他支持 Docker Compose v2 的 Docker 环境；
- Node.js 24.19.x；
- 项目声明的 pnpm 11.x；
- Playwright Chromium，仅在运行纵向验收时需要。

从仓库根目录创建不提交的 `.env`：

```bash
cp .env.example .env
```

至少替换以下本地自有值：

- `DB_PASSWORD`、`REDIS_PASSWORD`；
- 长度不少于 32 字符的 `JWT_SECRET`；
- `DEFAULT_ADMIN_PASSWORD`。

端口被占用时可以调整 `EXPOSE_DB_PORT`、`EXPOSE_REDIS_PORT`、`EXPOSE_SERVER_PORT`、
`EXPOSE_ADMIN_PORT` 和 `WEBSITE_PORT`。同时保持以下关系：

- 宿主机 E2E 连接使用的 `DB_PORT` 与 `EXPOSE_DB_PORT` 相同；
- `WEBSITE_PUBLIC_URL` 使用 `WEBSITE_PORT` 对外暴露的地址；
- Admin 的 `API_BASE_URL` 使用 Admin 端口下的 `/api`；
- 本地 Miniapp H5 若单独启动，在不提交的 `apps/miniapp/.env.development.local` 中把
  `VITE_MINIAPP_API_BASE_URL` 指向 `EXPOSE_SERVER_PORT`。

`WECHAT_APP_ID`、`WECHAT_APP_SECRET`、阿里云短信和腾讯云 COS 字段可以留空。长期本地 Compose
会启用 `SMS_DEV_CODE` 和 `local` 媒体 provider；这些开发能力不会进入生产模式。

## 3. 启动长期本地 Compose

先校验配置，再构建并启动：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env config --quiet
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env up -d --build
```

首次数据库启动完成后，显式写入最小基础数据：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env exec -T server pnpm --filter @petcare/server prisma:seed
```

seed 可以重复执行：它补齐权限和缺失的安全模板，但不重置数据库，也不覆盖已有管理员密码或操作者维护的官网内容。

确认所有容器处于 `healthy`：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env ps -a
```

默认入口如下；如果 `.env` 改过端口，以本地配置为准。

| 入口        | 默认地址                       | 用途                                   |
| ----------- | ------------------------------ | -------------------------------------- |
| Admin       | `http://localhost:8986`        | 管理官网内容、课堂文章、社区审核和权限 |
| Website     | `http://localhost:8080`        | 查看当前个人版公开内容                 |
| Server      | `http://localhost:3300`        | 本地 API 与健康检查                    |
| Server 健康 | `http://localhost:3300/health` | 进程存活                               |
| Server 就绪 | `http://localhost:3300/ready`  | PostgreSQL 与 Redis 就绪               |

Admin 使用 `.env` 中的 `DEFAULT_ADMIN_USERNAME` 和 `DEFAULT_ADMIN_PASSWORD` 登录。不要把实际账号或密码写入文档、截图、提交或测试报告。

## 4. 最小演示顺序

### 4.1 长期本地界面

1. 打开 Website，确认首页明确展示个人版的宠物档案、萌宠课堂和受控社区边界。
2. 打开 Admin 并使用本地管理员登录。
3. 查看官网内容、文章管理和帖子管理；新数据库中的文章和帖子空状态是预期结果。
4. 如需长期保留自己的本地内容，可在 Admin 中创建并发布课堂文章或维护官网内容。

基础 seed 有意不创建“看起来像真实运营”的用户、宠物、帖子或业务指标。长期演示内容由本地使用者明确创建并负责清理。

需要快速检查非空列表时，可显式写入带有 `[本地示例]` 标记的最小样例，并在验证后精确清理：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env exec -T server pnpm --filter @petcare/server prisma:seed:local-demo
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env exec -T server pnpm --filter @petcare/server prisma:cleanup:local-demo
```

命令只允许开发环境运行，不属于首次初始化或生产部署流程。样例使用固定保留 ID 幂等创建，清理不会按模糊文案匹配，
也不会删除操作者自行创建的其他本地内容。

### 4.2 社区与宠物档案纵向演示

安装依赖和 Chromium 后，从仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm --filter @petcare/admin exec playwright install chromium
pnpm test:e2e:personal
```

该命令在同一个隔离生命周期中执行：

- 真实 Nest Server、Admin、Website 和 Miniapp H5 构建与启动；
- 社区发布限流、待审核隔离、Admin 审核、公开读取、点赞、评论、举报、通知和下架；
- 宠物创建、两张图片上传、Miniapp 列表/详情/编辑回读、跨用户拒绝、重复命令和对象清理；
- 唯一 `admin_e2e_*` Schema、临时端口、临时媒体目录和测试账号的自动清理。

它不会 seed 或重置长期本地库的 `public` Schema，也不会访问真实腾讯云 COS。该命令只代表社区和宠物档案
受影响纵向场景通过，不等于完整 E2E、远端 CI 或生产环境通过。

## 5. 重启与持久化检查

在长期本地界面中确认一条已发布官网内容，或明确创建一条可识别的本地内容，然后重启应用与数据服务：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env restart postgres redis server website website-gateway admin
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env up -d --wait
```

重启后检查：

- 所有容器恢复为 `healthy`；
- Admin 仍可登录并读取重启前的数据；
- Website 仍可读取相同的已发布内容；
- 已经由本地 provider 上传且仍处于 active 状态的 `/media/` URL 仍可读取。

普通 `restart`、容器重建和 `down` 保留 PostgreSQL、Redis 与媒体 named volumes。只有明确执行
`down --volumes` 才会永久删除这些本地数据；不要把它作为日常停止命令。

## 6. 停止与排查

停止容器但保留数据：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env down
```

查看状态和 Server 日志：

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env ps -a
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env logs --tail=200 server
```

更完整的环境变量说明见[环境变量配置指南](../environment-variables.md)，生产运维边界见
[完整部署指南](./deployment.md)。
