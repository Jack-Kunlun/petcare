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

runner 在 POSIX 上把受管命令放入独立进程组，收到 `SIGINT`/`SIGTERM` 后先终止
完整进程组，再关闭服务和删除 schema，最终分别以 130/143 退出。Windows 使用
`taskkill.exe /PID <pid> /T /F` 清理受管进程树。Node.js 在 Windows 上的
`child.kill("SIGINT" | "SIGTERM")` 是强制终止，不能用于证明 Ctrl+C handler
或 finally 清理已执行；因此真实 OS signal 生命周期测试仅在 POSIX 运行，Windows
测试直接验证受控关闭后子孙 PID 与监听端口均消失。

失败时会保留 `playwright-report/`、截图、视频和 trace。

开发排查可在 `apps/admin` 中运行：

```bash
pnpm test:e2e:ui
pnpm test:e2e:debug
```

## 官网内容端到端场景

官网内容测试会在同一个隔离 schema 生命周期中启动 Nest Server、Astro Website 和 Admin。
runner 为三者分配独立端口，并通过 `ADMIN_E2E_WEBSITE_URL` 把 Website 地址传给 Playwright；
它们会在测试失败、启动失败和信号中断后按同一受控进程树清理。

可仅运行官网内容场景：

```bash
pnpm --filter @petcare/admin test:e2e -- website-content.spec.ts
```

该场景验证公开页与草稿隔离、固定修订预览的 `no-store`/`noindex` 响应、显式发布、历史恢复、
读者/编辑者/发布者的操作边界，以及预设区块不提供新增、删除、换型或排序控件。
素材选择使用 runner 写入隔离 schema 的确定性测试记录和本地 Website URL，不上传、读取或校验任何生产腾讯云 COS 对象；COS provider 契约仍由服务端单元测试覆盖。
