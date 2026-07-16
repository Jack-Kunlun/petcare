# 生产环境安全检查清单

在将PetCare部署到生产环境之前，请逐项检查以下安全配置。

## 🔴 P0 - 必须修复（高危）

### 1. Redis密码认证 ✅ 已修复

- [x] docker-compose.yml中添加了`--requirepass`参数
- [x] healthcheck使用密码进行认证
- [ ] **操作**: 在`.env.local`中设置强密码
  ```bash
  REDIS_PASSWORD=<使用 openssl rand -base64 24 生成>
  ```

### 2. 数据库端口保护 ✅ 已优化为环境变量控制

- [x] docker-compose.yml使用`EXPOSE_DB_PORT`变量控制
- [ ] **开发环境**: `.env.local`中设置 `EXPOSE_DB_PORT=5432`
- [ ] **生产环境**: `.env.local`中留空 `EXPOSE_DB_PORT=` 或注释掉

### 3. Redis端口保护 ✅ 已优化为环境变量控制

- [x] docker-compose.yml使用`EXPOSE_REDIS_PORT`变量控制
- [ ] **开发环境**: `.env.local`中设置 `EXPOSE_REDIS_PORT=6379`
- [ ] **生产环境**: `.env.local`中留空 `EXPOSE_REDIS_PORT=` 或注释掉

### 4. 强密码配置 ⚠️ 需手动配置

- [ ] 数据库密码不是`password`或`CHANGE_ME_TO_STRONG_PASSWORD`
  ```bash
  DB_PASSWORD=<使用 openssl rand -base64 32 生成>
  ```
- [ ] JWT密钥至少32字符
  ```bash
  JWT_SECRET=<使用 openssl rand -base64 48 生成>
  ```

---

## 🟡 P1 - 强烈建议（中危）

### 5. CORS配置 ✅ 已优化

- [x] 已从硬编码改为环境变量`ALLOWED_ORIGINS`
- [ ] **操作**: 在`.env.local`中配置实际域名
  ```bash
  ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
  ```

### 6. Swagger UI保护 ✅ 已实现

- [x] 生产环境自动禁用Swagger UI
- [x] 通过`NODE_ENV=production`控制

### 7. Docker资源限制 ✅ 已配置

- [x] 所有服务都设置了CPU和内存限制
- [x] Server服务设置了内存预留

---

## 🟢 P2 - 建议优化（低危）

### 8. 日志脱敏

- [ ] 配置winston过滤器，避免记录敏感信息
- [ ] 不在日志中输出完整的JWT token
- [ ] 对密码字段进行脱敏处理

### 9. 错误处理

- [ ] 生产环境不返回详细堆栈跟踪
- [ ] 实现全局异常过滤器

### 10. HTTPS配置

- [ ] 生产环境使用HTTPS
- [ ] 配置SSL证书
- [ ] Nginx配置HTTP到HTTPS重定向

### 11. 定期更新

- [ ] 定期更新Docker镜像基础版本
- [ ] 监控依赖包的安全漏洞
- [ ] 使用`npm audit`或`snyk`检查依赖安全性

---

## 🔧 快速生成强密码/密钥

```bash
# 生成32字节Base64字符串（适合JWT密钥）
openssl rand -base64 48

# 生成24字节Base64字符串（适合Redis密码）
openssl rand -base64 24

# 生成16进制字符串（适合数据库密码）
openssl rand -hex 32
```

---

## 📋 部署前最终检查

```bash
# 1. 确认.env.local文件存在且配置正确
ls -la .env.local

# 2. 检查是否使用了默认密码
grep -E "(password|CHANGE_ME)" .env.local

# 3. 验证JWT密钥长度
node -e "console.log(process.env.JWT_SECRET?.length >= 32 ? '✅ JWT密钥长度合格' : '❌ JWT密钥太短')"

# 4. 测试Docker Compose配置
docker-compose config

# 5. 启动服务并检查日志
docker-compose up -d
docker-compose logs -f
```

---

## 🚨 紧急响应

如果发现安全漏洞：

1. **立即轮换凭证**

   ```bash
   # 更改数据库密码
   docker-compose exec postgres psql -U postgres -c "ALTER USER petcare WITH PASSWORD 'new-password';"

   # 更改Redis密码
   # 修改docker-compose.yml和.env.local后重启
   docker-compose restart redis
   ```

2. **检查访问日志**

   ```bash
   docker-compose logs server | grep -i "unauthorized\|forbidden"
   ```

3. **审查网络连接**
   ```bash
   docker network inspect petcare-network
   ```

---

**最后更新**: 2026-07-16  
**维护者**: PetCare安全团队
