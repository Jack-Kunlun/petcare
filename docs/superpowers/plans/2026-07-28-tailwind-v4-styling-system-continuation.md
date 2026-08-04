# Tailwind v4 样式体系剩余实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Miniapp 升级为 Tailwind CSS v4 CSS-first，完成现有页面迁移，并继续完成 Admin px token、双端样式门禁、文档与全量验收。

**Architecture:** Miniapp 的纯 CSS 入口 `app.css` 通过 `@theme` 提供唯一的 px 设计 token，并选择性导入 Tailwind theme/utilities 以排除 Preflight；`WeappTailwindcss` 使用绝对 `cssEntries` 直接生成和转译 v4 CSS。Admin 保持 `@tailwindcss/vite` CSS-first；根目录 Node 脚本验证源码规则、主题契约和最终构建产物。

**Tech Stack:** Node.js 22.18+、pnpm 11、Taro 4.2、React 18/19、Tailwind CSS 4.3、weapp-tailwindcss 5.2.4、Dart Sass 1.102.0、Jest、Vitest、Node.js Test Runner。

## Global Constraints

- Miniapp 与 Admin 均使用 Tailwind CSS v4 CSS-first。
- `weapp-tailwindcss` 固定为 `5.2.4`，Node 范围保持 `>=22.18.0 <23`。
- Miniapp 的 `app.css` 是唯一 Tailwind 主题和全局样式入口；Tailwind 指令不得进入 SCSS。
- Miniapp 删除传统 `tailwind.config.js` 与 `postcss.config.js`，只保留 v4 `cssEntries` 生成路径。
- Miniapp 不导入 Tailwind Preflight；插件 `cssPreflight`、`rem2rpx`、`px2rpx` 和 Taro `pxtransform` 全部关闭。
- 两端默认字体大小为 `14px`；Miniapp 最终 WXSS 只能使用 px，不得包含 rem/rpx。
- Miniapp 自定义值必须定义为 `@theme` 语义 token；允许 `h-mm`、`w-action`，禁止 `h-[20px]`、`h-1/2`、`h-20px`。
- Miniapp 禁止任意值、变量简写、分数、important、变体、动态类名片段和数字尺寸类。
- Miniapp 不保留页面级 CSS/SCSS；可由 Tailwind 表达的样式直接写静态工具类。
- Admin 的 Tailwind 入口保持 `src/index.css`；独立 SCSS 不得包含 `@theme`、`@tailwind` 或 `@apply`。
- 不改变页面业务行为、认证状态机、接口调用和可见文案。

---

## 文件职责

### Miniapp v4 构建与页面

- `apps/miniapp/src/app.css`：v4 选择性入口、`@theme` px token、`page` 平台全局样式。
- `apps/miniapp/config/index.ts`：绝对 `cssEntries`、单位转换和 Webpack 插件注册。
- `apps/miniapp/config/index.test.ts`：v4 构建配置契约。
- `apps/miniapp/package.json`、`pnpm-lock.yaml`：Tailwind v4 依赖和构建命令。
- `apps/miniapp/src/pages/index/index.tsx`：首页静态工具类。
- `apps/miniapp/src/pages/auth/index.tsx`：认证页静态工具类。
- 对应 `index.test.tsx`：页面 token 契约。
- `scripts/style-output-policy.mjs`：WXSS/JS 与 Admin CSS 产物检查。
- `scripts/style-output-policy.test.mjs`：允许/拒绝的生成物样例。

### Admin、门禁和文档

- `apps/admin/src/index.css`：Admin v4 px token。
- `scripts/style-policy.mjs`：类名、文件边界、Miniapp `@theme` 与 Admin 主题契约。
- `scripts/style-policy.test.mjs`：纯函数和真实仓库契约。
- `package.json`、双端 `package.json`：质量命令。
- `.vscode/settings.json`：CSS/SCSS Tailwind 指令编辑器配置。
- `docs/09-development-guidelines/04-styling-standards.md`：长期样式规范。
- `AGENTS.md`、`README.md`、`docs/INDEX.md`：规范入口。

---

### Task 1: 将 Miniapp 切换为 Tailwind v4 CSS-first 并完成页面迁移

**Files:**

- Modify: `apps/miniapp/package.json`
- Modify: `apps/miniapp/config/index.ts`
- Modify: `apps/miniapp/config/index.test.ts`
- Create: `apps/miniapp/src/app.css`
- Delete: `apps/miniapp/src/app.scss`
- Modify: `apps/miniapp/src/app.ts`
- Delete: `apps/miniapp/postcss.config.js`
- Delete: `apps/miniapp/tailwind.config.js`
- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Delete: `apps/miniapp/src/pages/index/index.css`
- Modify: `apps/miniapp/src/pages/index/index.test.tsx`
- Modify: `apps/miniapp/src/pages/auth/index.tsx`
- Delete: `apps/miniapp/src/pages/auth/index.css`
- Modify: `apps/miniapp/src/pages/auth/index.test.tsx`
- Modify: `scripts/style-output-policy.mjs`
- Modify: `scripts/style-output-policy.test.mjs`
- Modify: `pnpm-lock.yaml`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**

- Produces:
  - `miniappCssEntry: string`
  - `weappTailwindcssOptions: UserDefinedOptions`
  - `registerWeappTailwindcss(chain): void`
  - CSS utilities `h-mm`、`w-action`、`rounded-button`、`text-base` 等

- [ ] **Step 1: 将 v4 构建要求写入失败测试**

将 `apps/miniapp/config/index.test.ts` 的配置断言改为：

```typescript
expect(weappTailwindcssOptions.cssOptions).toEqual({
  cssPreflight: false,
  rem2rpx: false,
  px2rpx: false,
});
expect(weappTailwindcssOptions.cssEntries).toEqual([miniappCssEntry]);
expect(miniappCssEntry).toMatch(/src[\\/]app\.css$/);
expect(weappTailwindcssOptions.generator).not.toBe(false);
expect(weappTailwindcssOptions.tailwindcssBasedir).toMatch(/apps[\\/]miniapp$/);
expect(resolvedConfig.mini?.postcss?.pxtransform?.enable).toBe(false);
expect(resolvedConfig.mini?.webpackChain).toEqual(expect.any(Function));
expect(resolvedConfig.h5?.webpackChain).toEqual(expect.any(Function));
```

在 `scripts/style-output-policy.test.mjs` 的有效 Miniapp WXSS 中加入
`.h-mm{height:20px}`，并在缺失声明用例中断言 `height:20px`。

- [ ] **Step 2: 运行配置和产物测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest --runInBand config/index.test.ts
node --test scripts/style-output-policy.test.mjs
```

Expected: 配置测试因仍设置 `generator: false` 且缺少 `cssEntries` 失败；产物测试因尚未要求 `height:20px` 失败。

- [ ] **Step 3: 升级 Miniapp Tailwind 依赖**

Run:

```bash
pnpm --filter @petcare/miniapp add -D tailwindcss@^4.3.3
```

确认 `apps/miniapp/package.json` 中：

```json
"tailwindcss": "^4.3.3",
"weapp-tailwindcss": "5.2.4",
"sass": "1.102.0"
```

保持 pnpm 的 `minimumReleaseAgeExclude` 中已生成的 `weapp-tailwindcss@5.2.4`
及其精确传递依赖，不新增宽泛排除项。

- [ ] **Step 4: 实现 v4 原生生成配置**

在 `apps/miniapp/config/index.ts` 导出并使用：

```typescript
const projectRoot = path.resolve(__dirname, "..");

export const miniappCssEntry = path.resolve(projectRoot, "src/app.css");

export const weappTailwindcssOptions: WeappTailwindcssOptions = {
  cssEntries: [miniappCssEntry],
  cssOptions: {
    cssPreflight: false,
    rem2rpx: false,
    px2rpx: false,
  },
  tailwindcssBasedir: projectRoot,
};
```

删除 `generator: false`。保留 Miniapp/H5 的 `webpackChain` 注册以及
`mini.postcss.pxtransform.enable: false`。

- [ ] **Step 5: 将 Tailwind 入口改为纯 CSS**

创建 `apps/miniapp/src/app.css`，使用以下完整入口和 token：

```css
@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(".");

@theme {
  --spacing: initial;

  --color-transparent: transparent;
  --color-current: currentColor;
  --color-white: #ffffff;
  --color-surface: #f8fafc;
  --color-surface-muted: #eef2ff;
  --color-ink: #1f2937;
  --color-ink-strong: #202632;
  --color-muted: #667085;
  --color-muted-brand: #667085;
  --color-brand: #4a6cf7;
  --color-brand-strong: #3552c8;
  --color-danger: #c23b43;

  --spacing-none: 0px;
  --spacing-note: 12px;
  --spacing-compact: 16px;
  --spacing-section: 32px;
  --spacing-page: 40px;
  --spacing-page-y: 48px;
  --spacing-mm: 20px;
  --spacing-action: 240px;

  --text-base: 14px;
  --text-base--line-height: 20px;
  --text-description: 15px;
  --text-description--line-height: 24px;
  --text-subtitle: 16px;
  --text-subtitle--line-height: 24px;
  --text-welcome: 18px;
  --text-welcome--line-height: 26px;
  --text-heading: 28px;
  --text-heading--line-height: 36px;
  --text-hero: 36px;
  --text-hero--line-height: 44px;

  --radius-button: 12px;
  --radius-card: 20px;
  --shadow-card: 0 12px 40px rgb(26 77 54 / 8%);
}

/* page 无法挂载 Tailwind 类名，保留为唯一全局平台样式。 */
page {
  background-color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
}
```

删除 `apps/miniapp/src/app.scss`、`apps/miniapp/postcss.config.js` 和
`apps/miniapp/tailwind.config.js`，将 `app.ts` 改为 `import "./app.css";`。

- [ ] **Step 6: 完成两个页面的静态工具类**

首页使用以下完整类名：

```text
box-border flex min-h-screen flex-col items-center justify-center p-page
mb-compact text-hero font-bold text-ink
text-subtitle text-muted
mt-section text-muted-brand
mt-section w-action rounded-button border-none bg-brand text-white
mt-section flex flex-col items-center
text-welcome font-semibold text-ink-strong
mt-section w-action rounded-button border border-solid border-brand bg-white text-brand-strong
```

认证页使用以下完整类名：

```text
box-border flex min-h-screen items-center justify-center bg-surface-muted px-section py-page-y
box-border w-full rounded-card bg-white px-section py-page shadow-card
block text-heading font-bold text-ink-strong
mt-note block text-description text-muted-brand
mt-section rounded-button border-none bg-brand text-white
mt-compact block text-base text-danger
```

两个按钮复用同一条静态字符串。删除页面 CSS 与导入，不改变条件、事件和文案。

- [ ] **Step 7: 扩充 Miniapp 产物关键声明**

将 `MINIAPP_REQUIRED_DECLARATIONS` 固定为：

```javascript
const MINIAPP_REQUIRED_DECLARATIONS = [
  "font-size:14px",
  "height:20px",
  "width:240px",
  "border-radius:12px",
];
```

真实页面目前不使用 `h-mm`，因此在 `app.css` 增加：

```css
@source inline("h-mm");
```

该 safelist 只用于验证已批准的中性 token 能稳定生成，不允许添加任意值或数字类。

- [ ] **Step 8: 运行 Miniapp 全量验证**

Run:

```bash
pnpm --filter @petcare/miniapp exec jest --runInBand config/index.test.ts src/pages/index/index.test.tsx src/pages/auth/index.test.tsx
node --test scripts/style-output-policy.test.mjs
node scripts/style-policy.mjs miniapp
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp build:weapp
pnpm exec prettier --check apps/miniapp scripts/style-output-policy.mjs scripts/style-output-policy.test.mjs
git diff --check
```

Expected: 所有测试、Lint、类型和构建通过；WXSS 包含 `14px`、`20px`、`240px`、
`12px`，不含 rem/rpx/非法转义/通用 `*`；JS 不含运行时 `process`。

- [ ] **Step 9: 提交**

```bash
git add apps/miniapp/package.json apps/miniapp/config/index.ts apps/miniapp/config/index.test.ts apps/miniapp/src/app.css apps/miniapp/src/app.ts apps/miniapp/src/pages/index/index.tsx apps/miniapp/src/pages/index/index.test.tsx apps/miniapp/src/pages/auth/index.tsx apps/miniapp/src/pages/auth/index.test.tsx scripts/style-output-policy.mjs scripts/style-output-policy.test.mjs pnpm-lock.yaml pnpm-workspace.yaml
git add -u apps/miniapp/src/app.scss apps/miniapp/postcss.config.js apps/miniapp/tailwind.config.js apps/miniapp/src/pages/index/index.css apps/miniapp/src/pages/auth/index.css
git commit -m "refactor(miniapp): 升级 Tailwind v4 并重构页面"
```

---

### Task 2: 统一 Admin Tailwind v4 px token

**Files:**

- Modify: `apps/admin/src/index.css`
- Modify: `apps/admin/package.json`
- Modify: `scripts/style-policy.mjs`
- Modify: `scripts/style-policy.test.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces:
  - `validateAdminTheme(source: string): string[]`
  - Admin `--spacing`、`--breakpoint-*`、`--container-*`、`--text-*`、`--radius-*` px token

- [ ] **Step 1: 写 Admin 主题失败测试**

`validateAdminTheme()` 必须验证：

```text
--spacing: 4px
--text-base: 14px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--container-md: 448px
html 的 font-size: 14px
@theme 中不存在 rem/rpx
```

真实文件测试读取 `apps/admin/src/index.css` 并断言返回空数组。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test scripts/style-policy.test.mjs
```

Expected: FAIL，Admin 当前主题仍缺少完整 px token。

- [ ] **Step 3: 安装 Sass 并实现校验**

Run:

```bash
pnpm --filter @petcare/admin add -D sass@1.102.0
```

在 `style-policy.mjs` 导出 `validateAdminTheme()`，按 Step 1 的精确声明返回错误。

- [ ] **Step 4: 写入 Admin px token**

在 `apps/admin/src/index.css` 的 `@theme` 中加入：

```css
--spacing: 4px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--container-md: 448px;
--text-xs: 12px;
--text-xs--line-height: 16px;
--text-sm: 14px;
--text-sm--line-height: 20px;
--text-base: 14px;
--text-base--line-height: 20px;
--text-xl: 20px;
--text-xl--line-height: 28px;
--text-2xl: 24px;
--text-2xl--line-height: 32px;
--text-3xl: 30px;
--text-3xl--line-height: 36px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-2xl: 16px;
--radius-full: 9999px;
```

将 `@theme` 和 `:root` 的 `--radius: 0.5rem` 改为 `--radius: 8px`。保留现有
颜色、dark theme、`@import "tailwindcss"` 和基础层规则。

Admin 构建脚本改为：

```json
"build": "tsc --noEmit && vite build && node ../../scripts/style-output-policy.mjs admin dist"
```

- [ ] **Step 5: 验证并提交 Admin**

Run:

```bash
node --test scripts/style-policy.test.mjs scripts/style-output-policy.test.mjs
node scripts/style-policy.mjs admin
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin build
git diff --check
```

Expected: 策略、测试、Lint、类型和构建通过；Admin CSS 包含 `14px` 且无 rem/rpx。

```bash
git add apps/admin/src/index.css apps/admin/package.json scripts/style-policy.mjs scripts/style-policy.test.mjs pnpm-lock.yaml
git commit -m "refactor(admin): 统一 Tailwind px 样式体系"
```

---

### Task 3: 校验 Miniapp @theme token 与接入质量门禁

**Files:**

- Modify: `scripts/style-policy.mjs`
- Modify: `scripts/style-policy.test.mjs`
- Modify: `package.json`
- Modify: `apps/miniapp/package.json`
- Modify: `apps/admin/package.json`
- Modify: `.vscode/settings.json`

**Interfaces:**

- Produces:
  - `extractMiniappThemeTokens(source: string): Set<string>`
  - `validateMiniappTheme(source: string): string[]`
  - 根命令 `pnpm lint:styles`

- [ ] **Step 1: 写 Miniapp 主题与命令失败测试**

测试必须覆盖：

```javascript
const theme = `
  @theme {
    --spacing-mm: 20px;
    --spacing-action: 240px;
    --text-base: 14px;
    --radius-button: 12px;
  }
`;

assert.deepEqual([...extractMiniappThemeTokens(theme)].sort(), ["action", "base", "button", "mm"]);
assert.deepEqual(validateMiniappTheme(theme), []);
assert.notDeepEqual(validateMiniappTheme("@theme { --spacing-mm: 1rem; }"), []);
```

真实仓库契约必须断言 `app.css` 包含完整 token、选择性 Tailwind import、`source(".")`
与 `@source inline("h-mm")`，且不存在 `preflight.css`、rem、rpx。

三个 package 契约必须断言：

```text
root lint:styles = node scripts/style-policy.mjs all
miniapp lint:styles = node ../../scripts/style-policy.mjs miniapp
admin lint:styles = node ../../scripts/style-policy.mjs admin
root test:tooling 同时包含 style-policy.test.mjs 与 style-output-policy.test.mjs
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test scripts/style-policy.test.mjs
```

Expected: FAIL，主题接口与 package 命令尚未实现。

- [ ] **Step 3: 实现主题契约**

`extractMiniappThemeTokens()` 提取以下命名空间的 token 后缀：

```javascript
/--(?:spacing|color|text|radius|shadow)-([a-z][a-z0-9-]*):/g;
```

忽略行高变量 `--text-<name>--line-height`。`validateMiniappTheme()` 必须检查：

```text
--spacing-mm: 20px
--spacing-action: 240px
--text-base: 14px
--radius-button: 12px
--color-brand: #4a6cf7
app.css @theme 中不存在 rem/rpx
```

`checkStylePolicy("miniapp")` 读取 `app.css` 后调用该函数，并继续执行现有类名和文件边界规则。源码文件边界同时改为只允许 `apps/miniapp/src/app.css`。

- [ ] **Step 4: 接入 package 和编辑器**

根目录新增：

```json
"lint:styles": "node scripts/style-policy.mjs all"
```

根 `lint` 改为 `pnpm lint:styles && turbo run lint`，`test:tooling` 同时运行两个策略测试。
Miniapp/Admin 增加各自 `lint:styles`，并在自身 `lint` 前运行该命令。

`.vscode/settings.json` 增加：

```json
"scss.lint.unknownAtRules": "ignore"
```

将 Tailwind CSS IntelliSense 的 Miniapp 配置映射改为 `apps/miniapp/src/app.css`，移除
已删除的 `tailwind.config.js` 映射。

- [ ] **Step 5: 验证并提交门禁**

Run:

```bash
node --test scripts/style-policy.test.mjs scripts/style-output-policy.test.mjs
pnpm lint:styles
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/admin lint
pnpm exec prettier --check package.json apps/miniapp/package.json apps/admin/package.json .vscode/settings.json scripts
git diff --check
```

Expected: 主题、源码、命令、编辑器和格式契约全部通过。

```bash
git add scripts/style-policy.mjs scripts/style-policy.test.mjs package.json apps/miniapp/package.json apps/admin/package.json .vscode/settings.json
git commit -m "chore(tooling): 接入双端样式质量门禁"
```

---

### Task 4: 完善文档并执行全量验收

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Create: `docs/09-development-guidelines/04-styling-standards.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/superpowers/specs/2026-07-28-tailwind-styling-system-design.md`

**Interfaces:**

- Consumes: Tasks 1–3 的双端 v4 构建、主题契约和质量命令。
- Produces: 长期样式规范和完整验收证据。

- [ ] **Step 1: 编写并链接样式规范**

规范必须明确记录：

```text
Miniapp/Admin 均使用 Tailwind v4 CSS-first
Miniapp 使用 app.css @theme 与绝对 cssEntries
默认字号 14px，自适应容器 + px token
h-mm 允许；h-[20px]、h-1/2、h-20px 禁止
Miniapp 禁止页面样式文件、动态类名和未批准变体
Miniapp app.css 与独立 SCSS、Admin CSS 与独立 SCSS 的边界
pnpm lint:styles、双端构建和产物检查命令
微信开发者工具样式不刷新时关闭“代码自动热重载”并使用 Taro watch
```

在 `docs/INDEX.md`、`README.md` 和 `AGENTS.md` 添加精简入口与强制规则。
将设计文档状态更新为“已实施”。

- [ ] **Step 2: 运行局部验收**

Run:

```bash
node --test scripts/style-policy.test.mjs scripts/style-output-policy.test.mjs
pnpm lint:styles
pnpm --filter @petcare/miniapp test
pnpm --filter @petcare/admin test
pnpm --filter @petcare/miniapp build:weapp
pnpm --filter @petcare/admin build
pnpm format
pnpm format:check
git diff --check
```

Expected: 所有策略、双端测试、双端构建和格式检查通过。

- [ ] **Step 3: 运行完整质量门禁**

Run:

```bash
pnpm check
pnpm test:coverage
```

Expected:

- 格式、样式策略、ESLint、类型检查、全部单元测试与构建通过；
- Miniapp WXSS 含 `14px/20px/240px/12px` 且无 rem/rpx；
- Admin CSS 使用 px token且无 rem/rpx；
- 覆盖率命令退出码为 0；
- 构建与测试不遗留未跟踪产物。

- [ ] **Step 4: 提交并检查状态**

```bash
git add AGENTS.md README.md docs/09-development-guidelines/04-styling-standards.md docs/INDEX.md docs/superpowers/specs/2026-07-28-tailwind-styling-system-design.md
git commit -m "docs: 完善双端 Tailwind v4 开发规范"
git status --short
git log -8 --oneline
```

Expected: 工作树干净；新增提交均使用中文 Conventional Commits。

---

## 官方实现依据

- [Tailwind CSS v4 Theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS v4 禁用 Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight)
- [weapp-tailwindcss 重要配置](https://tw.icebreaker.top/docs/api/options/important)
- [weapp-tailwindcss Taro 多端配置](https://tw.icebreaker.top/docs/multi-platform#taro)
