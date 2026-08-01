# Admin 端到端测试

本目录使用 Playwright Chromium 验证真实管理员登录、控制台统计与核心导航。

## 首次准备

```bash
docker compose up -d postgres redis
pnpm --filter @petcare/admin exec playwright install chromium
```

本地运行时，根目录 `.env` 必须提供可用的数据库连接字段、
`DEFAULT_ADMIN_USERNAME`、`DEFAULT_ADMIN_PHONE` 和 `DEFAULT_ADMIN_PASSWORD`；CI
只读取 CI 注入的环境变量。

## 运行

从仓库根目录执行：

```bash
pnpm --filter @petcare/admin test:e2e
```

版本控制内的 E2E runner 会为每次运行生成唯一的 `admin_e2e_*` PostgreSQL
schema，并按 `db push → build → seed → 启动临时 Server/Admin → Playwright →
关闭服务 → DROP SCHEMA IF EXISTS` 完成完整生命周期。Server 与 Admin 使用每次
动态分配的端口，不会复用本机已有服务，也绝不会重置或 seed `public`。即使构建、
seed、启动或测试失败，runner 仍会关闭已启动服务并删除隔离 schema。

失败时会保留 `playwright-report/`、截图、视频和 trace。

开发排查可在 `apps/admin` 中运行：

```bash
pnpm test:e2e:ui
pnpm test:e2e:debug
```
