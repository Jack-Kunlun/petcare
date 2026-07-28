# Admin 端到端测试

本目录使用 Playwright Chromium 验证真实管理员登录、控制台统计与核心导航。

## 首次准备

```bash
docker compose up -d postgres redis
pnpm --filter @petcare/server prisma:push
pnpm --filter @petcare/server prisma:seed
pnpm --filter @petcare/admin exec playwright install chromium
```

根目录 `.env` 必须提供可用的 `DEFAULT_ADMIN_USERNAME` 和
`DEFAULT_ADMIN_PASSWORD`，且数据库中已通过 seed 初始化该管理员。

## 运行

从仓库根目录执行：

```bash
pnpm --filter @petcare/admin test:e2e
```

Playwright 自动启动 Server `3000` 与 Admin `8986`。失败时会保留
`playwright-report/`、截图、视频和 trace。

开发排查可在 `apps/admin` 中运行：

```bash
pnpm test:e2e:ui
pnpm test:e2e:debug
```
