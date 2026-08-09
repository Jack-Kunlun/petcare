# Node 24 与非 Miniapp 依赖维护设计

## 背景

仓库当前有 13 个未处理的 Dependabot PR。现有 PR 同时存在运行时版本不一致、依赖族只升级一部分、Miniapp React 18 被错误带入 React 19 升级，以及 `pnpm-lock.yaml` 大范围无关重写等问题，不能直接逐个合并。

本设计采用 Node 24 LTS，并明确排除 `apps/miniapp`。现有 Dependabot PR 作为版本发现和审查输入，最终由两笔范围清晰、可独立验证的维护 PR 替代。

## 目标

- 将项目运行时从 Node 22 统一迁移到受支持的 Node 24 LTS。
- 更新除 `apps/miniapp` 外、当前 Dependabot PR 涉及的依赖。
- 保证关联依赖族同步升级，避免运行时或 peer dependency 混装。
- 修复最新远端基线上可以复现的 CI 故障。
- 仅产生必要的锁文件变化，并保持 Miniapp manifest 不变。
- 两笔替代 PR 通过全部检查后依次合并，再关闭已被替代的旧 PR。

## 非目标

- 不修改 `apps/miniapp` 中的任何文件或依赖声明。
- 不处理纯 Miniapp 的 PR #6 和 #7，也不关闭它们。
- 不进行 ESLint 10、Node 26 或其他未被现有 PR/CI 故障要求的主版本迁移。
- 不为了追求“最新”而扩大为全仓库依赖普查。
- 不重写历史计划或历史规格中的 Node 22 记录；只更新现行规范和部署文档。

## 版本策略

### Node

- 开发版本：Node `24.19.0`。
- `engines.node`：`>=24.12.0 <25`。当前锁文件中的 Babel 和 native 依赖要求 Node 24.11/24.12 以上，因此不能只声明 `>=24.0.0`。
- `.nvmrc`：`24.19.0`。
- GitHub Actions：使用 Node `24.19.0`。
- Docker：使用 Node 24.19 Alpine 系列镜像，并在 Admin/Server 构建与运行阶段保持一致。
- 同步根目录和 UniApp 的 engine 约束、现行 README、部署文档、`AGENTS.md` 及相应契约测试。

### 兼容性优先的依赖目标

以下版本已于 2026-08-09 从 npm registry 核对：

- `eslint`、`@eslint/js`：`9.39.5`。保留 9.x，暂不引入 ESLint 10 的主版本迁移。
- `typescript-eslint`、`@typescript-eslint/eslint-plugin`、`@typescript-eslint/parser`：`8.66.0`，在 root/Admin/Server 中保持同族一致。
- `turbo`：`2.10.9`。
- Admin `react`、`react-dom`：`19.2.8`。
- Admin `@types/react`：`19.2.18`；`@types/react-dom`：`19.2.4`。
- Admin `@radix-ui/react-dialog`：`1.1.23`。
- Server `prisma`、`@prisma/client`、`@prisma/adapter-pg`：`7.9.1`，三者同步。
- GitHub Actions `actions/checkout`、`actions/setup-node`：`v7`。

若实施时 registry 已发布更新版本，只接受同一兼容主版本内、不会扩大迁移范围的补丁更新；主版本变化需重新评估而不是自动采用。

## PR 拆分

### PR 1：Node 24 与 GitHub Actions

负责：

- Node 版本声明、CI、Docker 和现行文档的统一迁移。
- `actions/checkout` 与 `actions/setup-node` 升级到 v7。
- 更新 `workspace-contract` 与 `ci-policy` 等精确断言。
- 在 Node 24.19 上验证安装、工具测试、lint、类型检查、构建、测试和 Docker 构建。

该 PR 替代 #1、#2 和 #14。#14 的 Node 25 方案不合并。

### PR 2：非 Miniapp 依赖与 CI 修复

基于已合并的 PR 1：

- 同步更新 ESLint、TypeScript ESLint、Turbo、Admin React/Radix 和 Server Prisma 依赖族。
- 使用仓库固定的 pnpm 11.15.1 更新锁文件，只保留目标升级及不可避免的传递依赖变化。
- 确认 `apps/miniapp/package.json` 和锁文件中的 Miniapp importer 没有直接依赖变化。
- 复现并修复仍存在的 Jest、UniApp 构建、Prettier 和工具测试故障。

该 PR 替代 #4、#5、#8、#9、#10、#11、#12 和 #13。混合 PR 中只保留 root/Admin/Server 的合理升级，不移植 Miniapp 变更。

## CI 故障处理原则

- 先在未修改的目标基线上运行最小失败命令，记录失败输出。
- 对每个故障建立可证伪的根因假设，先确认根因再修改依赖或代码。
- Jest 当前出现 `jest-runtime@30.4.2` 与 `jest-environment-node/jest-mock@30.4.1` 的版本组合；这只是高概率根因，必须通过版本对齐实验验证，不能仅凭堆栈直接下结论。
- UniApp 的 ECharts/ZRender 故障必须在最新主线上重新复现；本地较新的提交可能已经修复，不能重复引入相同变更。
- 工具测试基线当前在“清除真实子孙进程及其监听端口”用例失败或超时；合并前必须判断是 Windows 特有测试问题、资源清理竞态还是实际回归。
- 每个真实缺陷都应添加或保留能在修复前失败、修复后通过的回归测试；纯版本对齐问题至少保留精确的契约或安装验证。

## 验证门槛

每笔 PR 至少执行：

1. `pnpm install --frozen-lockfile`
2. `pnpm test:tooling`
3. `pnpm format:check`
4. `pnpm lint`
5. `pnpm typecheck`
6. `pnpm test:ci`
7. `pnpm build`
8. `docker compose build server admin`
9. `git diff --check`

同时检查：

- `apps/miniapp` 没有文件差异。
- Node、ESLint、TypeScript ESLint、React 和 Prisma 各依赖族不存在意外混装。
- `pnpm-lock.yaml` 没有无关的全量格式重写。
- GitHub Actions 全部通过后才允许合并。

## GitHub PR 生命周期

1. 从最新远端主线创建隔离分支和工作树，不夹带本地主分支的其他任务提交。
2. 创建并推送 PR 1，等待全部检查通过后合并。
3. 从更新后的主线创建 PR 2，完成依赖和剩余 CI 修复，检查通过后合并。
4. 合并替代 PR 后，关闭相应旧 Dependabot PR，并在关闭说明中链接替代 PR。
5. #6、#7 保持原状，不评论、不关闭、不合并。

## 安全与回滚

- 两笔 PR 分开合并，Node 迁移与依赖升级可独立回滚。
- 不使用当前本地 `master` 作为 PR 基线，避免带入尚未推送的其他任务提交。
- 不在检查失败时强制合并，也不使用管理员权限绕过分支保护。
- GitHub 令牌虽具备更高权限，本任务只使用读取、推送分支、创建/合并 PR 和关闭被替代 PR 所需的最小操作集合。
