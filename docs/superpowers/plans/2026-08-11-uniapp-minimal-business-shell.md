# UniApp 最小业务壳实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 Vitesse/Wot Starter 的全部官方演示与非目标平台依赖，将 `apps/uniapp` 收敛为只保留 Wot UI、UnoCSS 和四端能力的最小 PetCare 业务壳。

**Architecture:** 应用启动链路收敛为 `createSSRApp -> App.vue -> pages/index/index.vue`。保留 Uni Manifest、Pages、Components、Auto Import 和 UnoCSS 的必要构建能力，删除 Router、Pinia、Alova、ECharts、主题、TabBar、Mock 与示例分包。

**Tech Stack:** Vue 3、UniApp、Wot UI 2、UnoCSS、Vite 5、TypeScript、ESLint、Prettier、Vitest、pnpm workspace。

## Global Constraints

- Node.js 必须为 `>=24.12.0 <25`，pnpm 必须为 `>=11.0.0 <12`。
- 目标平台仅保留 H5、微信小程序、Android App、iOS App。
- 必须保留 `@wot-ui/ui`、`@wot-ui/unocss-preset` 与 `@uni-helper/unocss-preset-uni`。
- 不迁移 Taro 业务，不新增业务状态、请求封装、路由封装或图表替代库。
- 不运行四端构建、E2E、Docker、PostgreSQL、Redis 或其他服务。
- 不修改主工作区现有的 `docs/10-brand-system/generated/`、社区精选计划或其他无关改动。
- 执行前使用隔离 worktree；主工作区已有 `auto-imports.d.ts`、`manifest.json`、`pages.json` 改动不得被静默覆盖。
- 不新增依赖；删除依赖后必须更新 `pnpm-lock.yaml`。

---

### Task 1: 建立最小业务壳契约并删除演示源码

**Files:**

- Create: `scripts/uniapp-minimal-shell.test.mjs`
- Modify: `package.json`
- Modify: `scripts/uniapp-engineering-config.test.mjs`
- Modify: `scripts/repository-policy.test.mjs`
- Modify: `.prettierignore`
- Modify: `apps/uniapp/eslint.config.mjs`
- Modify: `apps/uniapp/src/main.ts`
- Modify: `apps/uniapp/src/App.vue`
- Modify: `apps/uniapp/src/pages/index/index.vue`
- Modify: `apps/uniapp/vite.config.ts`
- Modify: `apps/uniapp/pages.config.ts`
- Modify: `apps/uniapp/manifest.config.ts`
- Modify: `apps/uniapp/README.md`
- Delete: `apps/uniapp/alova.config.ts`
- Delete: `apps/uniapp/src/App.ku.vue`
- Delete: `apps/uniapp/src/api/`
- Delete: `apps/uniapp/src/components/`
- Delete: `apps/uniapp/src/composables/`
- Delete: `apps/uniapp/src/customize-tab-bar/`
- Delete: `apps/uniapp/src/layouts/`
- Delete: `apps/uniapp/src/pages/about/`
- Delete: `apps/uniapp/src/router/`
- Delete: `apps/uniapp/src/static/logo.svg`
- Delete: `apps/uniapp/src/store/`
- Delete: `apps/uniapp/src/subPages/`
- Delete: `apps/uniapp/src/subEcharts/`
- Delete: `apps/uniapp/src/subAsyncEcharts/`
- Delete: `apps/uniapp/src/theme.json`
- Delete: `apps/uniapp/src/uni_modules/mp-html/`
- Delete: `apps/uniapp/src/utils/`

**Interfaces:**

- Consumes: 当前 UniApp 工作区结构和根工程策略测试。
- Produces: 单页业务壳、无演示目录的源码树、可复用的最小壳契约测试。

- [ ] **Step 1: 写入失败的最小壳契约测试**

在 `scripts/uniapp-minimal-shell.test.mjs` 中使用 `node:test`、`node:assert/strict`、`fs/promises`：

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const uniappRoot = resolve(repositoryRoot, "apps/uniapp");

test("UniApp contains only the minimal PetCare shell", async () => {
  for (const relativePath of [
    "src/api",
    "src/components",
    "src/composables",
    "src/customize-tab-bar",
    "src/layouts",
    "src/router",
    "src/store",
    "src/subPages",
    "src/subEcharts",
    "src/subAsyncEcharts",
    "src/uni_modules/mp-html",
  ]) {
    await assert.rejects(access(resolve(uniappRoot, relativePath)));
  }

  const main = await readFile(resolve(uniappRoot, "src/main.ts"), "utf8");
  const page = await readFile(resolve(uniappRoot, "src/pages/index/index.vue"), "utf8");
  assert.doesNotMatch(main, /router|pinia|persistPlugin/);
  assert.match(page, /PetCare/);
  assert.match(page, /<wd-button/);
  assert.match(page, /(?:flex|items-center|rounded)/);
});
```

把 `scripts/uniapp-minimal-shell.test.mjs` 加入根 `test:tooling` 命令。

- [ ] **Step 2: 运行红测**

Run:

```powershell
node --test scripts/uniapp-minimal-shell.test.mjs
```

Expected: FAIL，至少报告 `src/api` 或 `src/subPages` 仍存在。

- [ ] **Step 3: 删除演示源码并写入最小入口**

将 `src/main.ts` 收敛为：

```ts
import { createSSRApp } from "vue";
import App from "./App.vue";
import "uno.css";

export function createApp() {
  return { app: createSSRApp(App) };
}
```

`App.vue` 只保留 `onLaunch` 和 Wot UI 主题样式；首页只保留 PetCare 标题、业务壳说明与一个 `wd-button`，不包含导航、外链、主题或 Mock。

`vite.config.ts` 保留：

- `UniHelperManifest`
- `UniHelperPages`，不配置分包
- `UniHelperComponents`，Resolver 仅为 `WotResolver()`
- `Uni`
- `AutoImport`，imports 仅为 `vue`、`uni-app` 和实际使用的 Wot UI hooks
- `UnoCSS`

移除 Layouts、uni-ku、ECharts、Router、Pinia、Alova 和目录扫描配置。

`pages.config.ts` 删除自定义 TabBar，只保留单页全局样式；`manifest.config.ts` 删除非目标平台和主题文件引用。

更新 `apps/uniapp/README.md`：说明项目现在是最小业务壳，删除 Starter samples 说明，仅保留四端运行命令、App ID 和签名安全提示。

- [ ] **Step 4: 更新工程配置测试**

- 将 Vue fixed-point 样本改为 `src/pages/index/index.vue`。
- 删除静态演示多行文本测试。
- 删除 Alova 生成 API 文件保护测试。
- 从 `.prettierignore`、UniApp ESLint ignores 与仓库策略测试中移除已经删除的 API 生成文件规则。

- [ ] **Step 5: 运行 Task 1 绿测**

Run:

```powershell
node --test scripts/uniapp-minimal-shell.test.mjs scripts/uniapp-engineering-config.test.mjs scripts/repository-policy.test.mjs
apps/uniapp/node_modules/.bin/eslint.cmd apps/uniapp --quiet
apps/uniapp/node_modules/.bin/vue-tsc.cmd --noEmit
```

Expected: 所有测试和静态检查 PASS。

- [ ] **Step 6: 提交源码精简**

```powershell
git add package.json .prettierignore scripts/uniapp-minimal-shell.test.mjs scripts/uniapp-engineering-config.test.mjs scripts/repository-policy.test.mjs apps/uniapp
git commit -m "refactor(uniapp): 收敛为最小业务壳"
```

---

### Task 2: 删除无用依赖和非目标平台脚本

**Files:**

- Modify: `apps/uniapp/package.json`
- Modify: `apps/uniapp/tsconfig.json`
- Modify: `apps/uniapp/uno.config.ts`
- Modify: `scripts/uniapp-minimal-shell.test.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 的单页业务壳与最小 Vite 配置。
- Produces: 仅支持 H5、微信小程序、Android、iOS 的依赖清单和脚本。

- [ ] **Step 1: 扩展失败的依赖契约**

在 `scripts/uniapp-minimal-shell.test.mjs` 中断言以下依赖不存在：

```js
const forbiddenDependencies = [
  "@alova/adapter-uniapp",
  "@alova/mock",
  "@alova/shared",
  "@vueuse/core",
  "@wot-ui/router",
  "alova",
  "echarts",
  "pinia",
  "uni-echarts",
  "vue-i18n",
  "zrender",
];

for (const dependency of forbiddenDependencies) {
  assert.equal(manifest.dependencies?.[dependency], undefined, dependency);
}
```

同时断言支付宝、百度、京东、快手、飞书、QQ、抖音、小红书、快应用和 Harmony 的依赖及脚本不存在；四个目标端脚本仍存在。

- [ ] **Step 2: 运行红测**

Run: `node --test scripts/uniapp-minimal-shell.test.mjs`

Expected: FAIL，报告 `echarts` 等依赖仍存在。

- [ ] **Step 3: 精简 package、TypeScript 与 UnoCSS**

保留运行时依赖：

```text
@dcloudio/uni-app
@dcloudio/uni-app-plus
@dcloudio/uni-components
@dcloudio/uni-h5
@dcloudio/uni-mp-weixin
@wot-ui/ui
@wot-ui/unocss-preset
tslib
vue
```

保留实现这些依赖所需的现有构建、类型检查、Lint、UnoCSS 和测试开发依赖；移除 Alova、uni-ku、Layouts、Carbon 图标、支付宝类型、Uni Automator、Uni Vue Devtools 等无消费者的直接依赖。

`tsconfig.json` 的 types 删除 `@mini-types/alipay` 与 `uni-echarts/global`。`uno.config.ts` 删除 `presetIcons`，只保留 UniApp 与 Wot Preset。

脚本只保留标准生命周期及：

```text
dev:h5
dev:mp-weixin
dev:app-android
dev:app-ios
build:h5
build:mp-weixin
build:app-android
build:app-ios
```

- [ ] **Step 4: 更新锁文件**

Run:

```powershell
$env:CI="true"
corepack pnpm install --frozen-lockfile=false
```

Expected: exit 0；`pnpm-lock.yaml` 只反映 UniApp importer 和被移除依赖闭包的变化。

- [ ] **Step 5: 运行依赖绿测和静态检查**

Run:

```powershell
node --test scripts/uniapp-minimal-shell.test.mjs scripts/workspace-contract.test.mjs
corepack pnpm --filter @petcare/uniapp lint
corepack pnpm --filter @petcare/uniapp typecheck
corepack pnpm --filter @petcare/uniapp test
```

Expected: 全部 PASS；Vitest 允许显示 no test files。

- [ ] **Step 6: 提交依赖精简**

```powershell
git add apps/uniapp/package.json apps/uniapp/tsconfig.json apps/uniapp/uno.config.ts scripts/uniapp-minimal-shell.test.mjs pnpm-lock.yaml
git commit -m "chore(uniapp): 移除演示与非目标平台依赖"
```

---

### Task 3: 同步生成配置并完成最终验收

**Files:**

- Modify: `apps/uniapp/src/auto-imports.d.ts`
- Modify: `apps/uniapp/src/components.d.ts`
- Modify: `apps/uniapp/src/manifest.json`
- Modify: `apps/uniapp/src/pages.json`
- Modify: `apps/uniapp/src/uni-pages.d.ts`
- Test: `scripts/uniapp-minimal-shell.test.mjs`
- Test: `scripts/uniapp-engineering-config.test.mjs`
- Test: `scripts/workspace-contract.test.mjs`
- Test: `scripts/repository-policy.test.mjs`

**Interfaces:**

- Consumes: Task 1 的最小构建配置与 Task 2 的依赖树。
- Produces: 与最小业务壳一致的生成文件及完整静态验收证据。

- [ ] **Step 1: 停止现有 UniApp 开发进程并记录主工作区差异**

确认没有正在写入生成文件的 UniApp dev 进程。保存主工作区以下文件的 diff，仅用于冲突核对，不在隔离 worktree 中还原：

```powershell
git diff -- apps/uniapp/src/auto-imports.d.ts apps/uniapp/src/manifest.json apps/uniapp/src/pages.json
```

- [ ] **Step 2: 使用最小配置生成声明与 JSON**

在隔离 worktree 中启动一次 H5 开发命令，待 Vite 完成配置加载和文件生成后立即终止：

```powershell
corepack pnpm --filter @petcare/uniapp dev:h5
```

不访问业务 API，不启动其他服务。确认生成文件中不再出现 Router、Pinia、Alova、ECharts、About 或演示分包引用。

- [ ] **Step 3: 运行残余引用检查**

Run:

```powershell
rg -n "echarts|uni-echarts|zrender|alova|pinia|@wot-ui/router|subPages|subEcharts|subAsyncEcharts|uni-ku|mp-html" apps/uniapp --glob "!README.md"
```

Expected: exit 1，无匹配。

- [ ] **Step 4: 运行最终静态验收**

Run:

```powershell
corepack pnpm --filter @petcare/uniapp format:check
corepack pnpm --filter @petcare/uniapp lint
corepack pnpm --filter @petcare/uniapp typecheck
corepack pnpm --filter @petcare/uniapp test
node --test scripts/uniapp-minimal-shell.test.mjs scripts/uniapp-engineering-config.test.mjs scripts/repository-policy.test.mjs scripts/workspace-contract.test.mjs
git diff --check
```

Expected: 所有命令 PASS；不执行 build 或 E2E。

- [ ] **Step 5: 检查删除规模与锁文件范围**

Run:

```powershell
git diff --stat HEAD~2..HEAD
git diff -- apps/uniapp/package.json pnpm-lock.yaml
git status --short
```

确认没有 `docs/10-brand-system/generated/`、社区精选计划或其他任务文件进入 diff。

- [ ] **Step 6: 提交生成文件同步**

```powershell
git add apps/uniapp/src/auto-imports.d.ts apps/uniapp/src/components.d.ts apps/uniapp/src/manifest.json apps/uniapp/src/pages.json apps/uniapp/src/uni-pages.d.ts
git commit -m "chore(uniapp): 同步最小业务壳生成配置"
```

- [ ] **Step 7: 最终审查**

对设计规格提交至当前 HEAD 做 Standards 与 Spec 两轴只读审查。若存在 Critical 或 Important finding，先修复并重跑本任务全部验证；无问题后再请求合并。
