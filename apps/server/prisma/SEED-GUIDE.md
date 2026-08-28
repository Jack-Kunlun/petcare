# 默认数据初始化指南

## 初始化内容

幂等种子脚本会创建或更新以下数据：

- 36 个后台权限点；
- 1 个系统角色 `super_admin`，并关联全部权限；
- 1 个不绑定手机号的默认管理员，账号和密码由环境变量提供；
- 默认管理员与 `super_admin` 的角色关联。

脚本可以重复执行，不会生成重复账号、角色或权限关联。

## 必需配置

在项目根目录 `.env` 中配置：

```bash
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=请替换为至少12位的强密码
```

密码只以 Argon2id 哈希写入数据库。不要提交包含真实密码的 `.env`。

## Schema 迁移与首次数据初始化

空数据库初始化，以及之后每次生产 Schema 发布，都使用已提交的 Prisma Migrate 迁移：

```bash
pnpm --filter @petcare/server prisma:migrate:deploy
```

只有在需要写入首次基础数据时，才显式执行种子：

```bash
pnpm --filter @petcare/server prisma:seed
```

`prisma:push` 仅用于可丢弃的本地 Schema 实验，绝不属于部署流程。

再次执行种子时，已有管理员的账号、昵称、密码和状态不会被覆盖；已有官网草稿/已发布版本指针，以及
系统设置的已发布版本指针也会保留。平台权限目录及其关联允许按当前目录同步。

## 登录方式

管理员可以使用以下任一方式登录：

- 手机号或账号 + 密码；
- 手机号 + 短信验证码（发送短信前需先通过图形验证码）。

本地开发可通过根 `.env` 的 `SMS_DEV_CODE` 使用固定验证码。生产环境禁止配置该变量，必须接入真实
短信发送器。

图形验证码没有固定答案，由后端随机生成并以 Redis 摘要形式保存；在 Admin 登录页中按图片输入即可。

## 故障排查

- 数据库或 Redis 在 Docker 中、Server 在宿主机运行时，使用 `DB_HOST=localhost` 和 `REDIS_HOST=localhost`。
- `DEFAULT_ADMIN_PASSWORD is required` 表示当前进程未读取根 `.env`；请从根目录执行 `pnpm dev:server` 或使用更新后的 Server 脚本。
- 唯一约束冲突时，先检查 `users.username`、`roles.role_name` 和 `permissions.permission_code` 是否存在人为重复数据。

---

**最后更新**：2026-07-22
