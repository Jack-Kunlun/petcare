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
