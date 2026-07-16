# PetCare 安全审计报告

**审计日期**: 2026-07-16  
**审计范围**: Docker配置、环境变量、应用层配置  
**风险等级**: 🔴高危 / 🟡中危 / 🟢低危

---

## 🔴 高危漏洞

### 1. 数据库端口暴露到公网

**位置**: `docker-compose.yml` line 14-15

```yaml
ports:
  - "${DB_PORT:-5432}:5432"
```

**风险**: PostgreSQL直接暴露到主机网络，可能被外部攻击者访问。

**修复方案**:

- **开发环境**: 保留端口映射便于调试
- **生产环境**: 移除ports配置，仅通过Docker内部网络访问

```yaml
# 生产环境应该注释掉或删除ports
# ports:
#   - "5432:5432"
```

---

### 2. Redis端口暴露且无密码认证

**位置**: `docker-compose.yml` line 38-40

```yaml
command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
ports:
  - "${REDIS_PORT:-6379}:6379"
```

**风险**:

- Redis无密码保护，任何能访问6379端口的用户都可以读写数据
- 可能导致数据泄露或被用于攻击（Redis曾被用于挖矿病毒传播）

**修复方案**:

```yaml
# 1. 添加密码认证
command: >
  redis-server 
  --appendonly yes 
  --maxmemory 256mb 
  --maxmemory-policy allkeys-lru
  --requirepass ${REDIS_PASSWORD:-change-me-in-production}

# 2. 生产环境移除端口暴露
# ports:
#   - "6379:6379"
```

同时在`.env.example`中强调：

```bash
# ⚠️ 生产环境必须设置强密码！
REDIS_PASSWORD=your-strong-redis-password-here
```

---

### 3. 弱默认密码

**位置**: `.env.example` 和 `docker-compose.yml`

```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
JWT_SECRET: ${JWT_SECRET:-change-this-to-a-random-secret-key-in-production}
```

**风险**: 如果用户忘记修改.env文件，会使用弱密码/密钥。

**修复方案**:

1. **生成强随机密码作为默认值**（使用脚本）：

```bash
# 生成强随机密码示例
openssl rand -base64 32
```

2. **在启动时检查并警告**：
   创建启动脚本检查是否使用默认密码，如果是则拒绝启动或发出强烈警告。

3. **更新.env.example**:

```bash
# ⚠️ 警告：以下均为示例值，生产环境必须修改！
DB_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD_$(openssl rand -hex 16)
JWT_SECRET=CHANGE_ME_$(openssl rand -hex 32)
```

---

## 🟡 中危漏洞

### 4. CORS配置硬编码

**位置**: `apps/server/src/main.ts` line 19-22

```typescript
app.enableCors({
  origin: ["http://localhost:3000"],
  credentials: true,
});
```

**风险**:

- 仅允许localhost，无法支持多环境部署
- 硬编码不利于配置管理

**修复方案**:

```typescript
// 从ConfigService读取允许的源
const allowedOrigins = configService.allowedOrigins.split(",");

app.enableCors({
  origin: allowedOrigins,
  credentials: true,
});
```

在ConfigService中添加：

```typescript
get allowedOrigins(): string {
  return process.env.ALLOWED_ORIGINS || 'http://localhost:3000';
}
```

在`.env.example`中添加：

```bash
# CORS允许的源（逗号分隔）
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

---

### 5. Swagger UI生产环境暴露

**位置**: `apps/server/src/main.ts` line 24-33

```typescript
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api-docs", app, document);
```

**风险**: API文档暴露所有接口细节，可能被攻击者利用。

**修复方案**:

```typescript
// 仅在开发环境启用Swagger
if (configService.nodeEnv !== "production") {
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);
}
```

或者添加认证保护：

```typescript
SwaggerModule.setup("api-docs", app, document, {
  swaggerOptions: {
    authAction: {
      bearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
});
```

---

### 6. JWT密钥强度不足

**位置**: `.env.example`

```bash
JWT_SECRET=`your-super-secret-jwt-key-change-in-production`
```

**风险**: 示例密钥长度不足，容易被暴力破解。

**修复方案**:

在`.env.example`中提供生成强密钥的方法：

```bash
# JWT密钥（至少32字符，建议使用以下命令生成）
# openssl rand -base64 48
JWT_SECRET=CHANGE_ME_GENERATE_WITH_OPENSSL_RAND_BASE64_48
```

在ConfigService中添加验证：

```typescript
get jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return secret;
}
```

---

## 🟢 低危问题

### 7. 日志可能包含敏感信息

**风险**: 应用日志可能记录密码、token等敏感信息。

**建议**:

- 使用winston等日志库的敏感信息过滤功能
- 不在日志中记录完整的JWT token
- 对密码字段进行脱敏处理

---

### 8. 错误信息可能泄露堆栈跟踪

**风险**: 生产环境返回详细错误信息可能暴露内部实现细节。

**建议**:

```typescript
// 在main.ts中添加全局异常过滤器
if (configService.nodeEnv === "production") {
  app.useGlobalFilters(new HttpExceptionFilter());
}
```

---

## 📋 修复优先级

| 优先级 | 漏洞                 | 影响范围 | 修复难度 |
| ------ | -------------------- | -------- | -------- |
| P0     | Redis无密码+端口暴露 | 🔴 严重  | 低       |
| P0     | 数据库端口暴露       | 🔴 严重  | 低       |
| P1     | 弱默认密码           | 🟡 中等  | 低       |
| P1     | JWT密钥强度          | 🟡 中等  | 低       |
| P2     | CORS硬编码           | 🟡 中等  | 低       |
| P2     | Swagger UI暴露       | 🟢 轻微  | 低       |
| P3     | 日志敏感信息         | 🟢 轻微  | 中       |
| P3     | 错误信息泄露         | 🟢 轻微  | 中       |

---

## ✅ 已发现的安全优点

1. ✅ **.gitignore正确配置** - .env.local不会被提交
2. ✅ **使用独立配置变量** - 便于管理和轮换
3. ✅ **Docker资源限制** - 防止DoS攻击
4. ✅ **健康检查配置** - 提高服务可用性
5. ✅ **ConfigService统一管理** - 避免硬编码

---

## 🔧 立即行动建议

1. **立即修复**（P0）:
   - 为Redis添加密码认证
   - 生产环境移除数据库和Redis的端口暴露

2. **本周内修复**（P1）:
   - 更新所有默认密码为强密码
   - 添加JWT密钥长度验证

3. **下个迭代修复**（P2-P3）:
   - CORS配置改为环境变量
   - 生产环境禁用Swagger或添加认证
   - 实施日志脱敏

---

**审计人**: AI Assistant  
**下次审计**: 建议在每次重大配置变更后进行
