# Docker Compose 使用指南

## 快速开始

### 1. 准备环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写实际配置值。

**重要安全配置：**

- **端口暴露控制**（开发/生产环境切换）：

  ```bash
  # 开发环境：暴露端口便于调试
  EXPOSE_DB_PORT=5432
  EXPOSE_REDIS_PORT=6379

  # 生产环境：留空以禁用外部访问（仅Docker内部网络可访问）
  EXPOSE_DB_PORT=
  EXPOSE_REDIS_PORT=
  ```

- **强密码要求**：
  ```bash
  # 生成强密码示例
  openssl rand -base64 32  # 用于DB_PASSWORD
  openssl rand -base64 24  # 用于REDIS_PASSWORD
  openssl rand -base64 48  # 用于JWT_SECRET
  ```

### 2. 启动服务

```bash
# 构建并启动所有服务
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 3. 访问服务

- **后台管理系统**: http://localhost:8986
- **API服务**: http://localhost:3000
- **API文档**: http://localhost:3000/api-docs
- **PostgreSQL**: localhost:5432（外部访问）
- **Redis**: localhost:6379（外部访问）

## 常用命令

### 服务管理

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

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs server

# 实时跟踪日志
docker-compose logs -f server

# 查看最近100行日志
docker-compose logs --tail=100 server

# 跟踪宿主机上的 Server 结构化应用日志（PowerShell）
Get-Content ./logs/server/application-*.log -Wait
```

Server 还会把 JSON 日志写入 `logs/server/application-%DATE%.log` 和
`logs/server/error-%DATE%.log`。文件按天或 20MB 轮转，gzip 压缩并保留 14 天。
`LOG_LEVEL` 默认为 `info`；不要在共享或生产环境使用 `debug` 记录原始请求正文。

### 数据管理

```bash
# 停止服务并删除数据卷（谨慎使用！）
docker-compose down -v

# 仅删除容器，保留数据卷
docker-compose down

# 查看数据卷
docker volume ls | grep petcare
```

### 进入容器

```bash
# 进入后端服务容器
docker-compose exec server sh

# 进入数据库容器
docker-compose exec postgres psql -U $DB_USERNAME -d $DB_NAME

# 进入Redis容器
docker-compose exec redis redis-cli
```

## 资源配置

各服务的资源限制：

| 服务       | CPU限制 | 内存限制 | 内存预留 |
| ---------- | ------- | -------- | -------- |
| PostgreSQL | 0.5核   | 512MB    | -        |
| Redis      | 0.25核  | 256MB    | -        |
| Server     | 0.5核   | 512MB    | 256MB    |
| Admin      | 0.25核  | 256MB    | -        |

## 健康检查

所有服务都配置了健康检查：

- **PostgreSQL**: 检查数据库是否就绪
- **Redis**: 检查Redis是否响应ping
- **Server**: 检查API文档页面是否可访问
- **Admin**: 检查Nginx是否正常服务

启动顺序：

1. PostgreSQL → Redis（并行）
2. Server（等待PostgreSQL和Redis健康）
3. Admin（等待Server健康）

## 持久化数据

以下数据通过Docker volumes持久化：

- `postgres-data`: PostgreSQL数据库文件
- `redis-data`: Redis持久化数据（AOF）

日志文件挂载到本地目录：

- `logs/server/`: 后端服务日志
- `logs/nginx/`: Nginx访问和错误日志

## 数据库初始化

首次启动时，`docker/init-db/` 目录下的SQL脚本会自动执行：

- `01-init.sql`: 创建必要的扩展和初始数据

可以在此目录添加更多初始化脚本。

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
# 检查PostgreSQL是否健康
docker-compose exec postgres pg_isready

# 查看数据库日志
docker-compose logs postgres
```

### Redis连接失败

```bash
# 测试Redis连接
docker-compose exec redis redis-cli ping

# 查看Redis日志
docker-compose logs redis
```

## 生产环境建议

1. **修改默认密码**: 务必更改 `.env` 中的默认密码
2. **JWT密钥**: 使用强随机字符串作为JWT_SECRET
3. **资源限制**: 根据服务器配置调整deploy.resources
4. **备份策略**: 定期备份postgres-data卷
5. **监控**: 配置容器监控和告警
6. **日志轮转**: 配置Docker日志驱动防止日志过大

## 备份与恢复

### 备份数据库

```bash
# 备份PostgreSQL
docker-compose exec postgres pg_dump -U $DB_USERNAME $DB_NAME > backup.sql

# 备份Redis
docker-compose exec redis redis-cli BGSAVE
```

### 恢复数据库

```bash
# 恢复PostgreSQL
cat backup.sql | docker-compose exec -T postgres psql -U $DB_USERNAME $DB_NAME
```
