# Docker 配置说明

项目的 Docker 构建入口位于仓库根目录：

- `docker-compose.yml`：生产 Compose 定义（含 HTTPS 边缘网关）
- `docker-compose.dev.yml`：本地开发覆盖，只把 PostgreSQL、Redis 绑定到本机回环
- `Dockerfile.server`：NestJS 服务镜像
- `Dockerfile.admin`：后台管理镜像
- `docker/nginx.conf`：Admin 静态资源与 API 代理配置
- `docker/init-db/`：PostgreSQL 首次创建数据卷时执行的初始化脚本

生产发布不在服务器本地构建镜像；只通过 GitHub Actions 的手动 `deploy.yml` 执行，详见
[手动部署指南](../docs/08-deployment/github-actions-deploy.md)。本页命令仅用于可丢弃的本地 Docker 诊断。

## 生产发布约束

生产 Compose 项目名固定为 `petcare`。`TCR_REGISTRY=ccr.ccs.tencentyun.com` 与 `TCR_NAMESPACE` 共同定位一个私有
命名空间，`server`、`admin`、`website`、`postgres`、`redis`、`nginx` 六个镜像族均从这里拉取；应用使用不可变完整 SHA 标签，
运行时镜像使用已验证的固定标签。每仓库保留最新 30 个标签，低于个人版每仓库 100 个标签的限制。

`/opt/petcare/current` 只指向不可变 release；`.env`、`.deploy-images.env`、`certs`、`logs` 和 PostgreSQL/Redis named volumes
都在 release 外持久保存。发布归档顶层只允许 `docker-compose.yml`、`docker/`、`scripts/`、`deploy/`，不能覆盖持久数据。

`scripts/server-init.sh` 只使用服务器已配置的 Ubuntu APT 源，要求 `docker compose version` 成功，创建持久目录和 `.env`，
不获取仓库也不启动应用。`TCR_PUSH_USERNAME`、`TCR_PUSH_PASSWORD` 仅供 Actions 构建；`TCR_PULL_USERNAME`、
`TCR_PULL_PASSWORD` 仅供部署。TCR 密码只在本次 runner/远端临时目录和临时 Docker config 中出现，并在发布结束时清理。

Miniapp 仍由独立 GitHub Actions 工作流上传微信，不使用 Docker、TCR 或生产服务器。完成首次发布、第二次发布、回退演练和
备份/恢复演练并获迁移验收前，保留旧 `GHCR_PULL_USER`、`GHCR_PULL_TOKEN` 与服务器 GitHub Deploy Key；验收后删除
`GHCR_PULL_USER`、`GHCR_PULL_TOKEN` 与服务器 GitHub Deploy Key。

## 常用命令

```bash
# 校验最终 Compose 配置
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env config

# 构建应用镜像，但暂不启动 Server
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env build server admin website

# 只启动迁移所需的 PostgreSQL 和 Redis
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis

# 空数据库初始化，以及之后每次生产 Schema 发布
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env run --rm server pnpm --filter @petcare/server prisma:migrate:deploy
# 仅在需要首次基础数据时显式执行
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env run --rm server pnpm --filter @petcare/server prisma:seed

# 迁移完成后启动全部应用及网关容器
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d

# 查看状态和日志
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env ps
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env logs -f server

# 停止容器但保留数据卷
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env down
```

`prisma:push` 仅可用于可丢弃的本地 Schema 实验，绝不属于 Docker 或生产部署流程。

删除数据卷会永久清除本地 PostgreSQL 和 Redis 数据。仅在确认需要重置环境时执行：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env down --volumes
```
