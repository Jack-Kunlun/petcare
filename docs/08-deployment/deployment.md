# PetCare 部署指南

本文档详细说明如何使用 Docker Compose 部署 PetCare 平台。

## 📋 目录

- [架构概览](#架构概览)
- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [服务说明](#服务说明)
- [安全配置](#安全配置)
- [运维管理](#运维管理)
- [故障排查](#故障排查)
- [生产环境建议](#生产环境建议)

---

## 架构概览

PetCare 采用微服务架构，通过 Docker Compose 进行容器编排：

```
┌─────────────────────────────────────────────────────┐
│              Docker Network (172.20.0.0/16)         │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐  │
│  │  Admin   │───▶│  Server  │───▶│ PostgreSQL   │  │
│  │ (Nginx)  │    │(Nest.js) │    │              │  │
│  └──────────┘    └──────────┘    └──────────────┘  │
│                       │                              │
│                       └─────────▶┌──────────────┐  │
│                                  │    Redis     │  │
│                                  │              │  │
│                                  └──────────────┘  │
│                                                      │
│  持久化: postgres-data · redis-data · logs          │
└─────────────────────────────────────────────────────┘
```

**查看交互式架构图**: [deployment-architecture.html](./deployment-architecture.html)

### 核心组件

| 服务       | 技术栈           | 端口        | 用途            |
| ---------- | ---------------- | ----------- | --------------- |
| Admin      | React + Nginx    | 80          | 后台管理系统    |
| Server     | Nest.js + Prisma | 3001        | API 服务        |
| PostgreSQL | PostgreSQL 15    | 5432 (可选) | 关系型数据库    |
| Redis      | Redis 7          | 6379 (可选) | 缓存 + 消息队列 |

---

## 前置要求

### 必需软件

- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **Git**: 用于克隆代码仓库

### 验证安装

```bash
docker --version        # Docker version 20.10.x
docker-compose --version # Docker Compose version v2.x.x
```

### 系统资源

最低配置：

- CPU: 2核
- 内存: 4GB
- 磁盘: 10GB 可用空间

推荐配置：

- CPU: 4核
- 内存: 8GB
- 磁盘: 20GB SSD

---

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd petcare
```

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env.local

# 编辑配置文件
# Windows: notepad .env.local
# macOS/Linux: nano .env.local
```

**最小化配置示例**（开发环境）：

```bash
DB_PASSWORD=your-strong-db-password
REDIS_PASSWORD=your-strong-redis-password
JWT_SECRET=$(openssl rand -base64 48)

# 开发环境暴露端口便于调试
EXPOSE_DB_PORT=5432
EXPOSE_REDIS_PORT=6379
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看实时日志
docker-compose logs -f
```

### 4. 访问应用

- **后台管理系统**: http://localhost:80
- **API 服务**: http://localhost:3001
- **API 文档**: http://localhost:3001/api-docs (仅开发环境)

### 5. 初始化数据库

首次启动时，Prisma 会自动执行迁移：

```bash
# 进入 Server 容器
docker-compose exec server sh

# 运行 Prisma 迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate

# 退出容器
exit
```

---

## 环境配置

### 核心环境变量

#### 数据库配置

```bash
DB_HOST=postgres          # Docker 内部网络使用服务名
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=<强密码>       # ⚠️ 必须修改
DB_NAME=petcare
DB_SCHEMA=public
```

#### Redis 配置

```bash
REDIS_HOST=redis          # Docker 内部网络使用服务名
REDIS_PORT=6379
REDIS_PASSWORD=<强密码>    # ⚠️ 必须设置
```

#### JWT 配置

```bash
JWT_SECRET=<至少32字符>    # ⚠️ 必须使用强随机密钥
JWT_EXPIRES_IN=7d
```

#### 端口暴露控制

```bash
# 开发环境：暴露端口便于调试
EXPOSE_DB_PORT=5432
EXPOSE_REDIS_PORT=6379

# 生产环境：留空禁用外部访问
EXPOSE_DB_PORT=
EXPOSE_REDIS_PORT=
```

#### CORS 配置

```bash
# 允许的源（逗号分隔）
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 生成强密码

```bash
# 数据库密码（32字节 Base64）
openssl rand -base64 32

# Redis 密码（24字节 Base64）
openssl rand -base64 24

# JWT 密钥（48字节 Base64）
openssl rand -base64 48
```

---

## 服务说明

### Admin 前端

**技术栈**: React 19 + Vite + Nginx

**特性**:

- 多阶段构建优化镜像大小
- Nginx 反向代理到 Server
- 静态资源缓存策略

**访问**: http://localhost:80

### Server 后端

**技术栈**: Nest.js + Prisma + PostgreSQL

**特性**:

- ConfigService 统一管理配置
- Prisma ORM 类型安全
- Swagger API 文档（仅开发环境）
- CORS 动态配置
- JWT 认证

**访问**:

- API: http://localhost:3001
- Docs: http://localhost:3001/api-docs

### PostgreSQL

**版本**: 15-alpine

**特性**:

- UTF8 编码
- 数据持久化到 Volume
- 自动初始化脚本支持
- 健康检查

**连接**: 仅在 Docker 内部网络可访问（除非设置 EXPOSE_DB_PORT）

### Redis

**版本**: 7-alpine

**特性**:

- AOF 持久化
- 密码认证
- 最大内存限制 256MB
- LRU 淘汰策略

**连接**: 仅在 Docker 内部网络可访问（除非设置 EXPOSE_REDIS_PORT）

---

## 安全配置

### 🔴 高危安全措施

#### 1. Redis 密码认证

✅ 已启用 `--requirepass` 参数

```yaml
command: >
  redis-server 
  --appendonly yes 
  --maxmemory 256mb 
  --maxmemory-policy allkeys-lru
  --requirepass ${REDIS_PASSWORD}
```

**操作**: 在 `.env.local` 中设置强密码

#### 2. 端口暴露控制

✅ 通过环境变量控制

```bash
# 开发环境
EXPOSE_DB_PORT=5432
EXPOSE_REDIS_PORT=6379

# 生产环境
EXPOSE_DB_PORT=
EXPOSE_REDIS_PORT=
```

#### 3. 强密码要求

✅ ConfigService 验证 JWT 密钥长度

```typescript
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}
```

### 🟡 中危安全措施

#### 4. CORS 配置

✅ 从环境变量读取

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

#### 5. Swagger UI 保护

✅ 生产环境自动禁用

```typescript
if (configService.nodeEnv !== "production") {
  SwaggerModule.setup("api-docs", app, document);
}
```

### 安全检查清单

详见: [SECURITY-CHECKLIST.md](../../SECURITY-CHECKLIST.md)

---

## 运维管理

### 常用命令

#### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启特定服务
docker-compose restart server

# 重新构建并启动
docker-compose up -d --build
```

#### 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs server

# 实时跟踪日志
docker-compose logs -f server

# 查看最近100行日志
docker-compose logs --tail=100 server
```

#### 进入容器

```bash
# 进入后端服务容器
docker-compose exec server sh

# 进入数据库容器执行 SQL
docker-compose exec postgres psql -U $DB_USERNAME -d $DB_NAME

# 进入 Redis 容器
docker-compose exec redis redis-cli -a $REDIS_PASSWORD
```

### 数据备份

#### 备份数据库

```bash
# 备份 PostgreSQL
docker-compose exec postgres pg_dump -U $DB_USERNAME $DB_NAME > backup_$(date +%Y%m%d).sql

# 备份 Redis
docker-compose exec redis redis-cli -a $REDIS_PASSWORD BGSAVE
```

#### 恢复数据库

```bash
# 恢复 PostgreSQL
cat backup_20260716.sql | docker-compose exec -T postgres psql -U $DB_USERNAME $DB_NAME
```

### 数据卷管理

```bash
# 查看数据卷
docker volume ls | grep petcare

# 备份数据卷
docker run --rm -v petcare_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# 恢复数据卷
docker run --rm -v petcare_postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

### 资源监控

```bash
# 查看容器资源使用
docker stats

# 查看特定容器
docker stats petcare-server petcare-postgres
```

---

## 故障排查

### 服务启动失败

```bash
# 查看详细日志
docker-compose logs server

# 检查容器状态
docker-compose ps

# 重新构建镜像
docker-compose build --no-cache server
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否健康
docker-compose exec postgres pg_isready -U $DB_USERNAME -d $DB_NAME

# 查看数据库日志
docker-compose logs postgres

# 检查网络连接
docker network inspect petcare-network
```

### Redis 连接失败

```bash
# 测试 Redis 连接
docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping

# 查看 Redis 日志
docker-compose logs redis
```

### 端口冲突

```bash
# 检查端口占用
# Windows
netstat -ano | findstr :3001

# macOS/Linux
lsof -i :3001

# 修改 .env.local 中的端口映射
# 例如: 将 3001 改为 3002
```

### 权限问题

```bash
# 确保日志目录有写权限
chmod -R 755 logs/

# Docker 用户权限（Linux）
sudo usermod -aG docker $USER
```

---

## 生产环境建议

### 1. 网络安全

- ✅ 禁用数据库和 Redis 的外部端口暴露
- ✅ 配置防火墙仅允许必要端口（80, 443）
- ✅ 使用 HTTPS（配置 Nginx SSL）
- ✅ 配置 CORS 白名单

### 2. 数据安全

- ✅ 定期备份数据库（每日全量 + 每小时增量）
- ✅ 使用强密码并定期轮换
- ✅ 加密敏感配置（考虑使用 Docker Secrets）
- ✅ 审计日志保留至少 90 天

### 3. 性能优化

- ✅ 根据实际负载调整资源限制
- ✅ 配置 PostgreSQL 连接池
- ✅ 启用 Redis 持久化
- ✅ 使用 CDN 加速静态资源

### 4. 监控告警

- ✅ 配置容器健康检查
- ✅ 集成 Prometheus + Grafana 监控
- ✅ 设置日志聚合（ELK / Loki）
- ✅ 配置告警通知（邮件 / Slack）

### 5. 高可用

- ✅ 使用 Docker Swarm 或 Kubernetes
- ✅ 配置数据库主从复制
- ✅ Redis Sentinel 或 Cluster
- ✅ 负载均衡（多个 Server 实例）

### 6. CI/CD

```yaml
# 示例 GitHub Actions 工作流
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and Deploy
        run: |
          docker-compose build
          docker-compose up -d
          docker-compose exec server npx prisma migrate deploy
```

---

## 附录

### Docker Compose 文件结构

```
petcare/
├── docker-compose.yml          # 主配置文件
├── Dockerfile.server           # 后端构建文件
├── Dockerfile.admin            # 前端构建文件
├── .env.example                # 环境变量示例
├── .env.local                  # 本地配置（不提交Git）
├── docker/
│   ├── nginx.conf              # Nginx 配置
│   ├── init-db/
│   │   └── 01-init.sql         # 数据库初始化脚本
│   └── README.md               # Docker 使用说明
└── logs/
    ├── server/                 # 后端日志
    └── nginx/                  # Nginx 日志
```

### 相关文档

- [环境变量配置详解](../environment-variables.md)
- [安全审计报告](../../SECURITY-AUDIT.md)
- [安全检查清单](../../SECURITY-CHECKLIST.md)
- [开发规范](../09-development-guidelines/02-development-standards.md)

### 技术支持

遇到问题？

1. 查看日志: `docker-compose logs -f`
2. 检查健康状态: `docker-compose ps`
3. 查阅文档: 本文档和相关链接
4. 提交 Issue: GitHub Issues

---

**最后更新**: 2026-07-16  
**维护者**: PetCare 开发团队
