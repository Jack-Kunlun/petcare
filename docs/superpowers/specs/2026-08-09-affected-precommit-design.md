# PetCare 受影响范围 Pre-commit 门禁设计

## 1. 背景与问题

当前 `.husky/pre-commit` 依次运行 `lint-staged` 和 `commit:check`。`commit:check` 无条件执行七个 workspace 的 typecheck、根全量 lint、Server E2E 和 Admin E2E。因此一次仅修改 UniApp 配置的提交也要求 PostgreSQL、Redis、Prisma schema 和 Playwright 环境。

这不是改动风险决定的验证范围，而是本地门禁与 CI 职责混淆：GitHub Actions 已在 PR 和 `master` push 中分别执行全量 format、lint、typecheck、unit test、build 和带 PostgreSQL/Redis 的 E2E。重复在每次 pre-commit 执行 E2E 增加时间、环境依赖和误失败，却没有增加相应的提交级反馈价值。

## 2. 目标

- pre-commit 只检查实际暂存文件和受其影响的 workspace。
- 普通应用改动不启动无关后端服务，不运行 Server/Admin E2E。
- 共享包改动检查共享包自身及其消费者。
- 根工程配置与共享 ESLint 配置变更保守触发全部 workspace typecheck。
- Admin/Miniapp 的样式策略继续在相关源码变更时执行。
- 全量质量门禁、构建和 E2E 继续由 CI 与显式根命令承担。
- 保持 Windows、macOS 和 Linux 可用，Git 路径输入使用 NUL 分隔。

## 3. 非目标

- 不删除或弱化 `pnpm lint`、`pnpm typecheck`、`pnpm test:e2e`。
- 不修改 GitHub Actions 的 E2E 服务、Prisma 初始化或 Playwright 流程。
- 不让 pre-commit 运行 H5、微信、Android 或 iOS 构建。
- 不根据文件内容猜测业务影响；范围只由仓库路径和 workspace 依赖边界决定。
- 不在本次重构中引入新的 Git hook 框架或第三方 affected 工具。

## 4. 方案比较

### 方案 A：仅使用 lint-staged

速度最快，但无法发现单文件 lint 之外的 TypeScript 跨文件错误，也不会验证共享包消费者。只适合作为极端轻量策略，不采用。

### 方案 B：使用 Turbo 的 Git range affected

可以复用 workspace 图，但它基于提交历史或 merge base，不直接表达当前 index 中尚未提交的文件；在本地多提交、rebase 和部分暂存场景下容易扩大或偏离范围。不采用。

### 方案 C：暂存路径分类器加 workspace 过滤（采用）

直接读取 Git index，以纯函数把路径映射为 workspace、共享包扩散选择器、样式范围或全量兜底。它与开发者即将提交的内容一致，容易通过 fixture 测试锁定，也不依赖外部服务。

## 5. 架构

### 5.1 Hook 调用链

`.husky/pre-commit` 保持两步结构：

```text
lint-staged
  -> commit:check
```

- `lint-staged` 负责格式化和 lint 实际 staged 文件。
- `commit:check` 只负责受影响 workspace typecheck 和相关样式策略。
- `commit:check` 不再调用根 `pnpm lint` 或 `pnpm test:e2e`。

### 5.2 纯范围模块

新增 `scripts/commit-scope.mjs`，只负责范围计算，不启动子进程。导出：

```js
classifyStagedPaths(paths);
```

返回：

```js
{
  fullTypecheck: boolean,
  typecheckSelectors: string[],
  styleScopes: string[]
}
```

约束：

- 输入路径统一转换为 `/` 分隔。
- 输出去重并稳定排序，保证日志和测试确定性。
- 空路径返回空选择器，`commit:check` 成功退出。
- 模块不得读取 Git、环境变量或文件系统，便于 Node test runner 直接测试。

### 5.3 Git index 读取

`scripts/commit-check.mjs` 使用：

```text
git diff --cached --name-only --diff-filter=ACMR -z
```

读取新增、复制、修改和重命名路径。NUL 分隔避免空格、中文和特殊字符造成拆分错误。Git 命令失败时门禁失败，不降级成空范围。

### 5.4 Workspace 路径映射

应用路径映射为直接 selector：

| 路径前缀        | selector           |
| --------------- | ------------------ |
| `apps/admin/`   | `@petcare/admin`   |
| `apps/miniapp/` | `@petcare/miniapp` |
| `apps/uniapp/`  | `@petcare/uniapp`  |
| `apps/server/`  | `@petcare/server`  |

共享包使用 pnpm dependents selector，使自身与消费者一起检查：

| 路径前缀                 | selector                   |
| ------------------------ | -------------------------- |
| `packages/api-client/`   | `...@petcare/api-client`   |
| `packages/shared-types/` | `...@petcare/shared-types` |
| `packages/shared-utils/` | `...@petcare/shared-utils` |

多个 selector 在一次 pnpm 调用中组合，由 pnpm 去重匹配 workspace：

```text
pnpm --filter <selector-1> --filter <selector-2> --if-present run typecheck
```

### 5.5 全量兜底

以下变更设置 `fullTypecheck: true`：

- 根 `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- 根 `tsconfig.json` 或 `tsconfig.*.json`
- `packages/eslint-config-base/**`
- `.husky/pre-commit`
- `scripts/commit-check.mjs`
- `scripts/commit-scope.mjs`

全量模式继续检查以下七个 workspace，但通过一个带多个 `--filter` 的 pnpm 调用执行：

```text
@petcare/admin
@petcare/miniapp
@petcare/uniapp
@petcare/server
@petcare/api-client
@petcare/shared-types
@petcare/shared-utils
```

全量兜底只指 typecheck，不包含 E2E、build 或根全量 lint。

### 5.6 样式策略

以下 staged 路径增加样式范围：

- `apps/admin/src/**` -> `admin`
- `apps/miniapp/src/**` -> `miniapp`

`commit:check` 对每个受影响 scope 调用其现有 `lint:styles` script。UniApp 使用 UnoCSS/Wot UI，但当前仓库 style policy 只支持 Admin/Miniapp，因此不伪造 UniApp style scope。

### 5.7 lint-staged

保留现有按 workspace 的 ESLint 配置边界，但做以下调整：

- 所有 `eslint . --fix` 改为 `eslint --fix`，由 lint-staged 追加 staged 文件路径。
- 增加 `scripts/**/*.{js,mjs,cjs}` 的根 Prettier 和 ESLint。
- UniApp Prettier 使用根 `prettier --write`，并依赖根 `.prettierignore` 排除 vendor/generated 文件。
- 根 `.prettierignore` 必须包含：

```text
apps/uniapp/src/uni_modules/
apps/uniapp/src/auto-imports.d.ts
apps/uniapp/src/components.d.ts
apps/uniapp/src/uni-pages.d.ts
```

- UniApp ESLint ignores 同步排除上述生成声明，避免显式 staged 路径产生噪声或被自动修写。
- 不给 AXML 配置 Prettier parser。

## 6. 命令与错误处理

`commit-check` 的执行顺序：

```text
读取 staged paths
  -> 计算 scope
  -> 运行受影响 typecheck（如有）
  -> 运行 admin/miniapp style policy（如有）
```

- 每一步非零退出立即失败。
- 日志必须显示实际 selector 或“根配置变更，执行全量 typecheck”。
- 无 staged 路径时输出轻量提示并成功结束。
- Windows 继续通过 `ComSpec /d /s /c` 调用固定、由代码生成的 pnpm 参数；路径内容不拼入 shell 命令，只用于纯范围分类。

## 7. CI 与显式命令边界

以下现有命令保持不变：

```text
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
pnpm test:e2e
pnpm check
```

GitHub Actions 保持四层职责：

- quality：format、lint、typecheck、commitlint
- unit-test：tooling 和 workspace unit tests
- build：全 workspace build
- e2e：PostgreSQL、Redis、Prisma、Playwright 和根 E2E

因此 pre-commit 移除 E2E 不降低 PR 合并门禁，只移除本地重复执行。

## 8. 测试与验收

新增 `scripts/commit-scope.test.mjs`，至少覆盖：

1. 单一 UniApp 文件只选择 `@petcare/uniapp`。
2. 多应用文件合并并稳定排序 selector。
3. 共享包使用 dependents selector。
4. 根 manifest、lockfile、Turbo、根 tsconfig 和共享 ESLint 配置触发全量。
5. Admin/Miniapp 源码生成相应 style scope。
6. Windows 反斜杠路径被正确标准化。
7. 空输入返回空 scope。

更新 `scripts/repository-policy.test.mjs` 验证：

- pre-commit 仍调用 lint-staged 和 commit:check。
- commit-check 读取 NUL 分隔 staged paths。
- commit-check 不包含 `test:e2e`、根 `lint` 或 build。
- lint-staged 的 workspace ESLint 命令不包含 `eslint . --fix`。
- CI policy 仍保留完整 E2E job 和 `pnpm test:e2e`。

实施验证命令：

```text
node --test scripts/commit-scope.test.mjs scripts/repository-policy.test.mjs scripts/ci-policy.test.mjs
pnpm lint:scripts
pnpm --filter @petcare/uniapp typecheck
pnpm --filter @petcare/uniapp lint
pnpm --filter @petcare/uniapp test
pnpm format:check
git diff --check
```

不运行 Server/Admin E2E，不启动 PostgreSQL/Redis，不运行四端构建。

## 9. 风险控制

- **漏检共享消费者：** 使用 pnpm dependents selector，而不是只检查共享包自身。
- **根配置影响面不明确：** 明确路径进入全量 typecheck 兜底。
- **lint-staged 仍扫描全项目：** 移除 ESLint 命令中的 `.`。
- **生成文件被修写：** 根 Prettier ignore 与 UniApp ESLint ignore 双重保护。
- **路径含空格或中文：** Git 使用 `-z`，分类器接收完整字符串，不把 staged 路径拼入 shell。
- **本地门禁弱化：** CI 的全量质量、构建和 E2E 保持不变，并由 policy tests 锁定。
