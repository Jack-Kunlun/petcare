# 环境变量配置指南

## 环境变量列表

### 服务器配置

| 变量名     | 必填 | 默认值        | 说明                               |
| ---------- | ---- | ------------- | ---------------------------------- |
| `PORT`     | 否   | `3001`        | 服务器端口号                       |
| `NODE_ENV` | 否   | `development` | 运行环境（development/production） |

### 数据库配置（独立配置项）

| 变量名        | 必填 | 默认值      | 说明                  |
| ------------- | ---- | ----------- | --------------------- |
| `DB_HOST`     | ✅   | `localhost` | 数据库主机地址        |
| `DB_PORT`     | ✅   | `5432`      | 数据库端口号          |
| `DB_USERNAME` | ✅   | -           | 数据库用户名          |
| `DB_PASSWORD` | ✅   | -           | 数据库密码            |
| `DB_NAME`     | ✅   | `petcare`   | 数据库名称            |
| `DB_SCHEMA`   | 否   | `public`    | PostgreSQL Schema名称 |

示例：

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=petcare
DB_PASSWORD=password123
DB_NAME=petcare
DB_SCHEMA=public
```

### Redis配置（独立配置项）

| 变量名           | 必填 | 默认值      | 说明                          |
| ---------------- | ---- | ----------- | ----------------------------- |
| `REDIS_HOST`     | ✅   | `localhost` | Redis主机地址                 |
| `REDIS_PORT`     | ✅   | `6379`      | Redis端口号                   |
| `REDIS_PASSWORD` | 否   | -           | Redis密码（未启用认证时留空） |

示例：

```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### JWT配置

| 变量名           | 必填 | 说明                                      |
| ---------------- | ---- | ----------------------------------------- |
| `JWT_SECRET`     | ✅   | JWT签名密钥（生产环境请使用强随机字符串） |
| `JWT_EXPIRES_IN` | 否   | Token过期时间，默认`7d`                   |

### API配置

| 变量名         | 必填 | 说明                                        |
| -------------- | ---- | ------------------------------------------- |
| `API_BASE_URL` | 否   | API基础URL，默认`http://localhost:3001/api` |

### 第三方服务（可选）

| 变量名                         | 说明                       |
| ------------------------------ | -------------------------- |
| `WECHAT_APP_ID`                | 微信小程序AppID            |
| `WECHAT_APP_SECRET`            | 微信小程序AppSecret        |
| `ALIYUN_OSS_ACCESS_KEY_ID`     | 阿里云OSS AccessKey ID     |
| `ALIYUN_OSS_ACCESS_KEY_SECRET` | 阿里云OSS AccessKey Secret |
| `ALIYUN_OSS_BUCKET`            | 阿里云OSS Bucket名称       |
| `ALIYUN_OSS_REGION`            | 阿里云OSS区域              |

## 使用方法

1. 复制配置模板：

   ```bash
   # 在 apps/server 目录下创建 .env.local 文件
   cp docs/ENVIRONMENT-VARIABLES.md apps/server/.env.local
   ```

2. 编辑 `.env.local` 文件，填入实际值

3. 确保 `.env.local` 已添加到 `.gitignore`（默认已包含）

## 注意事项

- ⚠️ **永远不要**将 `.env.local` 提交到Git仓库
- ⚠️ 生产环境的 `JWT_SECRET` 必须使用强随机字符串
- ⚠️ 数据库密码不要使用弱口令
- ✅ 每个开发者应有自己的本地 `.env.local` 文件
- ✅ CI/CD环境中通过平台配置注入环境变量

## 代码中的使用方式

### Prisma数据库连接

Prisma需要完整的 `DATABASE_URL` 连接字符串。在应用启动时，需要将独立配置拼接为完整URL：

```typescript
// apps/server/src/config/database.ts
const DATABASE_URL = `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?schema=${process.env.DB_SCHEMA || "public"}`;
```

或者在 `package.json` 的启动脚本中设置：

```json
{
  "scripts": {
    "start:dev": "cross-env DATABASE_URL=\"postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=${DB_SCHEMA}\" nest start --watch"
  }
}
```

### Redis连接

Redis客户端初始化时使用独立配置：

```typescript
import { createClient } from "redis";

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});
```
