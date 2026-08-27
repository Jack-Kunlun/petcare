# Admin 端到端测试

本目录使用 Playwright Chromium 验证真实应用边界中的 Admin、Website 与 Miniapp 纵向场景。

## 首次准备

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
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

个人版当前受影响的社区与宠物档案链路可合并在同一个隔离生命周期中运行：

```bash
pnpm test:e2e:personal
```

该入口只选择 `community-content.spec.ts` 和 `pet-profile.spec.ts`，共享同一个一次性 Schema、
临时端口与媒体目录；它不是完整 Admin E2E 套件。

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

官网内容测试会在同一个隔离 schema 生命周期中启动 Nest Server、Astro Website、Admin 和 Miniapp H5。
runner 为四者分配独立端口，并通过 `ADMIN_E2E_WEBSITE_URL` 把 Website 地址传给 Playwright；
它们会在测试失败、启动失败和信号中断后按同一受控进程树清理。

可仅运行官网内容场景：

```bash
pnpm --filter @petcare/admin test:e2e -- website-content.spec.ts
```

该场景验证公开页与草稿隔离、固定修订预览的 `no-store`/`noindex` 响应、显式发布、历史恢复、
读者/编辑者/发布者的操作边界，以及预设区块不提供新增、删除、换型或排序控件。
素材选择使用 runner 写入隔离 schema 的确定性测试记录和本地 Website URL，不上传、读取或校验任何生产腾讯云 COS 对象；COS provider 契约仍由服务端单元测试覆盖。

## 课堂内容纵向端到端场景

课堂测试通过隔离 Admin HTTP 边界发布和下线文章，并在 375px Miniapp H5 中验证列表、搜索、详情和下线不可用状态。Miniapp H5 使用独立端口和临时 Vite 缓存，不会改写源码中的生成类型文件。

```bash
pnpm --filter @petcare/admin test:e2e:classroom
```

## 社区内容纵向端到端场景

社区测试在隔离 schema 中验证发布限流、待审核隔离、后台通过、Miniapp 可见、用户举报、权限拒绝和后台从举报上下架。场景只发布文字动态，不访问生产对象存储。

```bash
pnpm --filter @petcare/admin test:e2e:community
```

## 宠物档案纵向端到端场景

宠物档案测试在一次性 schema 中创建两名独立用户，贯通真实 Server 与 Miniapp H5，验证本人创建、两张图片上传、页面编辑与读取、跨用户统一隐藏、重复更新/删除，以及显式删图和随档案删除的对象清理。

```bash
pnpm --filter @petcare/admin test:e2e:pets
```

runner 仅为 E2E Server 进程预加载 `support/fake-cos.mjs`，把对象写入本次运行的临时目录并在退出时整体清理。该替身不会访问腾讯云，也不提供生产存储能力；真实 COS 的凭据、网络、权限和桶策略必须在对应环境另行验收。
