# PetCare API 环境变量配置示例

# 复制此文件为 .env 并填写实际值

# Database

DATABASE_URL="postgresql://user:password@localhost:5432/petcare?schema=public"

# Redis

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT

JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Server

PORT=3001
NODE_ENV=development

# WeChat MiniApp

WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret

# OSS (阿里云对象存储)

OSS_ACCESS_KEY=your-oss-access-key
OSS_SECRET_KEY=your-oss-secret-key
OSS_BUCKET=petcare
OSS_REGION=oss-cn-hangzhou
