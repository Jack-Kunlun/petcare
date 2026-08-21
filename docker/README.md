# Docker 配置说明

项目的 Docker 构建入口位于仓库根目录：

- `docker-compose.yml`：PostgreSQL、Redis、Server 与 Admin 编排
- `Dockerfile.server`：NestJS 服务镜像
- `Dockerfile.admin`：后台管理镜像
- `docker/nginx.conf`：Admin 静态资源与 API 代理配置
- `docker/init-db/`：PostgreSQL 首次创建数据卷时执行的初始化脚本

完整的环境准备、初始化、健康检查、日志、备份和生产部署说明统一维护在
[部署指南](../docs/08-deployment/deployment.md) 中。

## 常用命令

```bash
# 校验最终 Compose 配置
docker compose --env-file .env config

# 构建并启动全部容器
docker compose --env-file .env up -d --build

# 空数据库初始化，以及之后每次生产 Schema 发布
docker compose --env-file .env run --rm server pnpm --filter @petcare/server prisma:migrate:deploy
# 仅在需要首次基础数据时显式执行
docker compose --env-file .env run --rm server pnpm --filter @petcare/server prisma:seed

# 查看状态和日志
docker compose --env-file .env ps
docker compose --env-file .env logs -f server

# 停止容器但保留数据卷
docker compose --env-file .env down
```

`prisma:push` 仅可用于可丢弃的本地 Schema 实验，绝不属于 Docker 或生产部署流程。

删除数据卷会永久清除本地 PostgreSQL 和 Redis 数据。仅在确认需要重置环境时执行：

```bash
docker compose --env-file .env down --volumes
```
