# 双端 Tailwind 样式体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Miniapp 当前页面样式迁移到安全的 Tailwind CSS v3 工具类，完善 `weapp-tailwindcss` 构建链路，并为 Admin 建立 Tailwind CSS v4 的 px 设计 token 与双端自动化样式门禁。

**Architecture:** Miniapp 使用 `WeappTailwindcss` 接管 Taro Webpack 5 的 Tailwind 生成与微信类名转译，关闭所有 px/rem → rpx 转换，并以 `tailwind.config.js` 语义 token 约束类名。Admin 保持 Tailwind v4 CSS-first，由 `@theme` 提供 px token；根目录 Node 脚本负责双端源码策略和构建产物验证。

**Tech Stack:** Node.js 22.18+、pnpm 11、Taro 4.2、React 18/19、Tailwind CSS 3.4/4.3、weapp-tailwindcss 5.2.4、Dart Sass 1.102.0、Jest、Vitest、Node.js Test Runner。

## Global Constraints

- Miniapp 固定使用 Tailwind CSS v3；Admin 固定使用 Tailwind CSS v4 CSS-first 配置。
- `weapp-tailwindcss` 固定为 `5.2.4`，项目 Node 范围收紧为 `>=22.18.0 <23`。
- Dart Sass 固定为 `1.102.0`，在 Miniapp 与 Admin 中作为直接开发依赖。
- 两端默认字体大小固定为 `14px`，布局使用自适应容器与 px 设计 token。
- Miniapp 的 Taro `pxtransform`、插件 `cssOptions.rem2rpx` 和 `cssOptions.px2rpx` 全部关闭。
- Miniapp 最终 WXSS 不得包含 `rem`、`rpx`、通用 `*` 选择器或未转换的 Tailwind 转义字符。
- Miniapp 禁止 `[]`、`()`、`/`、`!`、任意变体、动态类名片段和数值编码别名。
- Miniapp 自定义尺寸必须在 `tailwind.config.js` 中使用语义或中性别名；允许 `h-mm`，禁止 `h-[20px]`、`h-1/2`、`h-20px`。
- Miniapp 仅保留 `src/app.scss` 作为全局样式入口，不保留页面级 CSS/SCSS。
- Admin 的 Tailwind 入口保持 `src/index.css`；SCSS 不得包含 `@theme`、`@tailwind` 或 `@apply`。
- 两端能由 Tailwind 表达的样式必须直接写工具类，只有平台选择器、第三方覆盖或复杂动画才允许使用 SCSS。
- 本轮不改变页面业务行为、接口调用、认证状态机和可见文案。

---

## 文件结构

### 根目录样式门禁

- `scripts/style-policy.mjs`：扫描 Miniapp 类名、样式文件边界和 Admin SCSS/Tailwind 约束。
- `scripts/style-policy.test.mjs`：样式源码策略的纯函数与真实仓库契约测试。
- `scripts/style-output-policy.mjs`：扫描 Miniapp WXSS/JS 与 Admin CSS 构建产物。
- `scripts/style-output-policy.test.mjs`：构建产物允许/拒绝样例。
- `package.json`：注册样式测试、lint-staged 和 Node 版本约束。

### Miniapp

- `apps/miniapp/config/index.ts`：注册 `WeappTailwindcss`，关闭单位转换。
- `apps/miniapp/config/index.test.ts`：构建配置契约。
- `apps/miniapp/tailwind.config.js`：Miniapp px token、颜色、尺寸、圆角和阴影。
- `apps/miniapp/postcss.config.js`：删除，避免与 `WeappTailwindcss` 重复生成 Tailwind。
- `apps/miniapp/src/app.scss`：Tailwind utilities 与 `page` 全局样式入口。
- `apps/miniapp/src/app.css`：迁移后删除。
- `apps/miniapp/src/app.ts`：改为导入 `app.scss`。
- `apps/miniapp/src/pages/index/index.tsx`：首页迁移为 Tailwind 工具类。
- `apps/miniapp/src/pages/index/index.css`：迁移后删除。
- `apps/miniapp/src/pages/index/index.test.tsx`：首页样式 token 回归。
- `apps/miniapp/src/pages/auth/index.tsx`：认证页迁移为 Tailwind 工具类。
- `apps/miniapp/src/pages/auth/index.css`：迁移后删除。
- `apps/miniapp/src/pages/auth/index.test.tsx`：认证页样式 token 回归。
- `apps/miniapp/package.json`、`pnpm-lock.yaml`：依赖、样式检查和产物校验命令。

### Admin

- `apps/admin/src/index.css`：Tailwind v4 px token、默认字体和主题变量。
- `apps/admin/package.json`、`pnpm-lock.yaml`：直接声明 Sass，并接入样式产物校验。

### 编辑器与文档

- `.vscode/settings.json`：SCSS 未知 at-rule 与 Tailwind 工作区配置。
- `AGENTS.md`：AI 助手必须遵守的双端样式规则。
- `README.md`：样式检查和双端构建入口。
- `docs/09-development-guidelines/04-styling-standards.md`：完整 Tailwind/SCSS 规范。
- `docs/INDEX.md`：新增样式规范索引。

---

### Task 1: 建立双端样式源码策略检查器

**Files:**

- Create: `scripts/style-policy.mjs`
- Create: `scripts/style-policy.test.mjs`

**Interfaces:**

- Produces:
  - `validateMiniappClassName(className: string): string[]`
  - `validateStyleFile(scope: "miniapp" | "admin", relativePath: string, source: string): string[]`
  - `extractStaticClassNames(source: string): { classNames: string[]; dynamicCount: number }`
  - `checkStylePolicy(repoRoot: string, scope: "miniapp" | "admin" | "all"): Promise<string[]>`

- [ ] **Step 1: 写 Miniapp 类名失败测试**

创建 `scripts/style-policy.test.mjs`：

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractStaticClassNames,
  validateMiniappClassName,
  validateStyleFile,
} from "./style-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("Miniapp 接受静态语义 token", () => {
  assert.deepEqual(validateMiniappClassName("flex h-mm bg-brand"), []);
  assert.deepEqual(extractStaticClassNames('<View className="h-mm text-base" />'), {
    classNames: ["h-mm", "text-base"],
    dynamicCount: 0,
  });
});

test("Miniapp 拒绝不安全和值编码类名", () => {
  for (const className of [
    "h-[20px]",
    "h-1/2",
    "h-20px",
    "bg-brand/50",
    "!w-full",
    "hover:bg-brand",
  ]) {
    assert.notDeepEqual(validateMiniappClassName(className), [], className);
  }
});

test("Miniapp 拒绝动态类名片段", () => {
  assert.deepEqual(extractStaticClassNames("<View className={`text-${tone}`} />").dynamicCount, 1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test scripts/style-policy.test.mjs
```

Expected: FAIL，提示找不到 `scripts/style-policy.mjs`。

- [ ] **Step 3: 实现类名提取与安全规则**

在 `scripts/style-policy.mjs` 实现：

```javascript
const valueFamilies =
  /^(?:h|w|min-h|max-h|min-w|max-w|p[trblxy]?|m[trblxy]?|gap[xy]?|inset[xy]?|top|right|bottom|left|text|rounded|border)-\d+(?:px|rpx|rem|vh|vw|%)?$/;

export function validateMiniappClassName(className) {
  const violations = [];

  for (const token of className.trim().split(/\s+/).filter(Boolean)) {
    if (/[\[\]()]/.test(token)) violations.push(`${token}: 禁止任意值或变量简写`);
    if (token.includes("/")) violations.push(`${token}: 禁止分数或透明度简写`);
    if (token.includes("!")) violations.push(`${token}: 禁止 important 修饰`);
    if (token.includes(":")) violations.push(`${token}: 变体未加入白名单`);
    if (valueFamilies.test(token)) violations.push(`${token}: 必须改用配置别名`);
  }

  return violations;
}

export function extractStaticClassNames(source) {
  const classNames = [];
  let matchedAttributes = 0;
  const literalPattern = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/gs;

  for (const match of source.matchAll(literalPattern)) {
    matchedAttributes += 1;
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    if (value.includes("${")) continue;
    classNames.push(value);
  }

  const totalAttributes = [...source.matchAll(/className\s*=/g)].length;
  const dynamicTemplates = [...source.matchAll(/className\s*=\s*\{\s*`[^`]*\$\{/gs)].length;

  return {
    classNames,
    dynamicCount: totalAttributes - matchedAttributes + dynamicTemplates,
  };
}
```

`validateStyleFile()` 必须执行：

- Miniapp 仅允许 `apps/miniapp/src/app.scss`；
- Miniapp `.css/.scss` 中禁止 `rem`、`rpx`；
- Admin 仅允许 `apps/admin/src/index.css` 作为 CSS；
- Admin `.scss` 禁止 `@theme`、`@tailwind`、`@apply`；
- TSX 中每个静态类名调用 `validateMiniappClassName()`；
- 发现动态 `className` 时返回包含相对路径的错误。

核心分支实现为：

```javascript
export function validateStyleFile(scope, relativePath, source) {
  const violations = [];
  const normalized = relativePath.replaceAll("\\", "/");

  if (scope === "miniapp" && /\.(?:css|scss)$/.test(normalized)) {
    if (normalized !== "apps/miniapp/src/app.scss") {
      violations.push(`${normalized}: Miniapp 禁止页面级样式文件`);
    }
    if (/\d(?:\.\d+)?(?:rem|rpx)\b/i.test(source)) {
      violations.push(`${normalized}: Miniapp 样式禁止 rem/rpx`);
    }
  }

  if (scope === "admin" && normalized.endsWith(".css")) {
    if (normalized !== "apps/admin/src/index.css") {
      violations.push(`${normalized}: Admin 仅允许 index.css 作为 Tailwind 入口`);
    }
  }

  if (
    scope === "admin" &&
    normalized.endsWith(".scss") &&
    /@(theme|tailwind|apply)\b/.test(source)
  ) {
    violations.push(`${normalized}: Admin SCSS 禁止 Tailwind 指令`);
  }

  return violations;
}
```

`checkStylePolicy()` 使用 `node:fs/promises.readdir({ withFileTypes: true })` 递归扫描对应
`apps/<scope>/src`，对 `.ts/.tsx/.js/.jsx/.css/.scss` 调用上述函数；Miniapp TSX 再调用
`extractStaticClassNames()` 与 `validateMiniappClassName()`。

- [ ] **Step 4: 补充文件边界与 CLI 测试**

追加测试：

```javascript
test("Miniapp 只允许全局 app.scss", () => {
  assert.deepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/app.scss", "@tailwind utilities;"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/pages/index/index.scss", ".page {}"),
    [],
  );
});

test("Admin SCSS 不处理 Tailwind 指令", () => {
  assert.deepEqual(
    validateStyleFile("admin", "apps/admin/src/components/chart.scss", ".chart::before {}"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("admin", "apps/admin/src/components/chart.scss", ".chart { @apply p-4; }"),
    [],
  );
});
```

CLI 使用 `node scripts/style-policy.mjs miniapp|admin|all`，逐行打印
`<relativePath>: <message>`，存在违规时设置 `process.exitCode = 1`，无违规则输出
`样式策略检查通过：<scope>`。

- [ ] **Step 5: 运行源码策略测试**

Run:

```bash
node --test scripts/style-policy.test.mjs
```

Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add scripts/style-policy.mjs scripts/style-policy.test.mjs
git commit -m "test(tooling): 增加双端样式规则校验"
```

---

### Task 2: 接入 Miniapp Tailwind v3 微信构建链路

**Files:**

- Modify: `package.json`
- Modify: `apps/miniapp/package.json`
- Modify: `apps/miniapp/config/index.ts`
- Create: `apps/miniapp/config/index.test.ts`
- Delete: `apps/miniapp/postcss.config.js`
- Move: `apps/miniapp/src/app.css` → `apps/miniapp/src/app.scss`
- Modify: `apps/miniapp/src/app.ts`
- Create: `scripts/style-output-policy.mjs`
- Create: `scripts/style-output-policy.test.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `WeappTailwindcss` from `weapp-tailwindcss/webpack`。
- Produces:
  - `weappTailwindcssOptions`
  - `registerWeappTailwindcss(chain)`
  - `checkMiniappOutput(outputRoot: string): Promise<string[]>`
  - `checkAdminOutput(outputRoot: string): Promise<string[]>`

- [ ] **Step 1: 写构建配置失败测试**

创建 `apps/miniapp/config/index.test.ts`：

```typescript
import config, { weappTailwindcssOptions } from "./index";

describe("Miniapp Tailwind build config", () => {
  it("keeps px output and registers both build targets", () => {
    expect(weappTailwindcssOptions.cssOptions).toEqual({
      rem2rpx: false,
      px2rpx: false,
    });
    expect(weappTailwindcssOptions.tailwindcssBasedir).toMatch(/apps[\\/]miniapp$/);
    expect(config.mini?.postcss?.pxtransform?.enable).toBe(false);
    expect(config.mini?.webpackChain).toEqual(expect.any(Function));
    expect(config.h5?.webpackChain).toEqual(expect.any(Function));
  });
});
```

- [ ] **Step 2: 写构建产物失败测试**

创建 `scripts/style-output-policy.test.mjs`，使用 `mkdtemp()` 创建临时产物：

```javascript
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function createOutput(files) {
  const root = await mkdtemp(path.join(tmpdir(), "petcare-style-output-"));

  for (const [relativePath, source] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, source, "utf8");
  }

  return root;
}

test("Miniapp 接受纯 px WXSS", async () => {
  const root = await createOutput({
    "app.wxss": "page{font-size:14px}.h-mm{height:20px}",
    "app.js": "App({})",
    "pages/index/index.wxss": ".w-action{width:240px;border-radius:12px}",
  });

  assert.deepEqual(await checkMiniappOutput(root), []);
});

test("Miniapp 拒绝 rpx、转义选择器和 process", async () => {
  const root = await createOutput({
    "app.wxss": ".h-\\[20px\\]{height:20rpx}*{box-sizing:border-box}",
    "app.js": "process.env.NODE_ENV",
  });

  const violations = await checkMiniappOutput(root);
  assert.ok(violations.some((item) => item.includes("rpx")));
  assert.ok(violations.some((item) => item.includes("转义")));
  assert.ok(violations.some((item) => item.includes("process")));
  assert.ok(violations.some((item) => item.includes("通用选择器")));
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand config/index.test.ts
node --test scripts/style-output-policy.test.mjs
```

Expected: 配置断言失败且产物策略模块不存在。

- [ ] **Step 4: 安装并锁定构建依赖**

Run:

```bash
pnpm --filter @petcare/miniapp add -D weapp-tailwindcss@5.2.4 sass@1.102.0
```

将根目录 `engines.node` 修改为：

```json
"node": ">=22.18.0 <23"
```

不得新增 `postinstall: weapp-tw patch`；v5 生成模式由 `WeappTailwindcss` 直接处理。

- [ ] **Step 5: 实现 Taro Webpack 配置**

在 `apps/miniapp/config/index.ts`：

```typescript
import path from "node:path";
import { defineConfig } from "@tarojs/cli";
import { WeappTailwindcss } from "weapp-tailwindcss/webpack";

const projectRoot = path.resolve(__dirname, "..");

export const weappTailwindcssOptions = {
  cssOptions: {
    rem2rpx: false,
    px2rpx: false,
  },
  tailwindcssBasedir: projectRoot,
};

export function registerWeappTailwindcss(chain: { merge(config: object): unknown }): void {
  chain.merge({
    plugin: {
      weappTailwindcss: {
        plugin: WeappTailwindcss,
        args: [weappTailwindcssOptions],
      },
    },
  });
}
```

在现有 `mini` 配置中设置：

```typescript
webpackChain: registerWeappTailwindcss,
postcss: {
  pxtransform: { enable: false, config: {} },
  cssModules: { enable: false },
},
```

在现有 `h5` 配置中增加 `webpackChain: registerWeappTailwindcss`。删除
`postcss.config.js`，将 `app.css` 改名为 `app.scss`，内容保持：

```scss
@tailwind utilities;

// page 无法挂载 Tailwind 类名，保留为唯一全局平台样式。
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
}
```

`app.ts` 改为 `import "./app.scss";`。

- [ ] **Step 6: 实现产物策略和构建命令**

`checkMiniappOutput()` 递归读取 `.wxss` 与 `.js`，返回以下违规：

```javascript
const miniappChecks = [
  { pattern: /\b(?:\d*\.?\d+)rem\b/i, message: "WXSS 禁止 rem" },
  { pattern: /\b(?:\d*\.?\d+)rpx\b/i, message: "WXSS 禁止 rpx" },
  { pattern: /\\(?:!|\[|\]|\(|\)|:|\/)/, message: "WXSS 存在未转换的 Tailwind 转义" },
  {
    pattern: /(^|[,>{+~]\s*)\*(?=[:{.,>+~\s]|$)/m,
    message: "WXSS 禁止通用选择器",
  },
  { pattern: /\bNaN\b/, message: "构建产物禁止 NaN" },
];
```

JS 额外检查 `/\bprocess(?:\.|\[)/`。全部 WXSS 合并后必须包含
`font-size:14px`、`width:240px` 和 `border-radius:12px`。

`checkAdminOutput()` 递归读取 `.css`，要求包含 `font-size:14px`，并拒绝 `rem`、`rpx`。
CLI 使用：

```bash
node scripts/style-output-policy.mjs miniapp apps/miniapp/dist
node scripts/style-output-policy.mjs admin apps/admin/dist
```

Miniapp 包脚本修改为：

```json
"build:weapp": "taro build --type weapp && node ../../scripts/style-output-policy.mjs miniapp dist"
```

- [ ] **Step 7: 运行配置、产物测试与 Miniapp 构建**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand config/index.test.ts
node --test scripts/style-output-policy.test.mjs
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp build:weapp
```

Expected: 配置测试与产物测试 PASS；构建成功，最终 WXSS 使用 px 且 JS 不含运行时 `process`。

- [ ] **Step 8: 提交**

```bash
git add package.json apps/miniapp/package.json apps/miniapp/config/index.ts apps/miniapp/config/index.test.ts apps/miniapp/src/app.scss apps/miniapp/src/app.ts scripts/style-output-policy.mjs scripts/style-output-policy.test.mjs pnpm-lock.yaml
git add -u apps/miniapp/postcss.config.js apps/miniapp/src/app.css
git commit -m "chore(miniapp): 接入 Tailwind 微信构建链路"
```

---

### Task 3: 使用 Tailwind 重构 Miniapp 当前页面

**Files:**

- Modify: `apps/miniapp/tailwind.config.js`
- Modify: `apps/miniapp/src/pages/index/index.tsx`
- Delete: `apps/miniapp/src/pages/index/index.css`
- Modify: `apps/miniapp/src/pages/index/index.test.tsx`
- Modify: `apps/miniapp/src/pages/auth/index.tsx`
- Delete: `apps/miniapp/src/pages/auth/index.css`
- Modify: `apps/miniapp/src/pages/auth/index.test.tsx`

**Interfaces:**

- Consumes: Task 1 的类名策略和 Task 2 的 Tailwind 构建链路。
- Produces: `page`、`section`、`compact`、`note`、`action`、`button`、`card`、`base`、`description`、`subtitle`、`welcome`、`heading`、`hero` 等稳定 token。

- [ ] **Step 1: 写页面工具类失败测试**

在首页测试增加：

```typescript
it("uses Miniapp-safe Tailwind tokens", () => {
  jest.mocked(useAuth).mockReturnValue({
    status: "guest",
    user: null,
    login: jest.fn(),
    bindPhone: jest.fn(),
    logout,
  });

  const { container } = render(<Index />);

  expect(container.firstElementChild).toHaveClass(
    "box-border",
    "flex",
    "min-h-screen",
    "p-page",
  );
  expect(screen.getByText("PetCare宠伴")).toHaveClass("text-hero", "text-ink");
  expect(screen.getByText("微信登录")).toHaveClass("w-action", "rounded-button", "bg-brand");
});
```

在认证页测试增加：

```typescript
it("uses semantic Tailwind tokens without unsafe syntax", () => {
  const { container } = render(<AuthPage />);

  expect(container.firstElementChild).toHaveClass(
    "min-h-screen",
    "bg-surface-muted",
    "px-section",
    "py-page-y",
  );
  expect(screen.getByText("登录 PetCare 宠伴")).toHaveClass("text-heading", "text-ink-strong");
  expect(screen.getByText("微信登录")).toHaveClass("rounded-button", "bg-brand");
});
```

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/pages/index/index.test.tsx src/pages/auth/index.test.tsx
```

Expected: FAIL，当前页面仍使用 `.container`、`.auth-page` 等语义 CSS 类。

- [ ] **Step 3: 配置完整 px token**

将 `tailwind.config.js` 的 `theme` 改为：

```javascript
theme: {
  colors: {
    transparent: "transparent",
    current: "currentColor",
    white: "#ffffff",
    surface: "#f5f5f5",
    "surface-muted": "#f6f8f7",
    ink: "#333333",
    "ink-strong": "#163c2b",
    muted: "#666666",
    "muted-brand": "#668074",
    brand: "#20a66a",
    "brand-strong": "#178854",
    danger: "#c83e3e",
  },
  spacing: {
    none: "0px",
    note: "12px",
    compact: "16px",
    section: "32px",
    page: "40px",
    "page-y": "48px",
  },
  fontSize: {
    base: ["14px", { lineHeight: "20px" }],
    description: ["15px", { lineHeight: "24px" }],
    subtitle: ["16px", { lineHeight: "24px" }],
    welcome: ["18px", { lineHeight: "26px" }],
    heading: ["28px", { lineHeight: "36px" }],
    hero: ["36px", { lineHeight: "44px" }],
  },
  borderRadius: {
    button: "12px",
    card: "20px",
  },
  width: {
    full: "100%",
    action: "240px",
  },
  minHeight: {
    screen: "100vh",
  },
  boxShadow: {
    card: "0 12px 40px rgb(26 77 54 / 8%)",
  },
  height: {
    mm: "20px",
  },
},
```

保留 `content`、空 `plugins` 和 `corePlugins.preflight: false`。

- [ ] **Step 4: 迁移首页并删除页面 CSS**

首页使用以下静态完整类名：

```tsx
<View className="box-border flex min-h-screen flex-col items-center justify-center p-page">
  <Text className="mb-compact text-hero font-bold text-ink">PetCare宠伴</Text>
  <Text className="text-subtitle text-muted">双模式O2O宠物服务平台</Text>
  <Text className="mt-section text-muted-brand">正在恢复登录状态…</Text>
  <Button className="mt-section w-action rounded-button border-none bg-brand text-white">
    微信登录
  </Button>
  <View className="mt-section flex flex-col items-center">
    <Text className="text-welcome font-semibold text-ink-strong">你好，...</Text>
    <Button className="mt-section w-action rounded-button border border-solid border-brand bg-white text-brand-strong">
      退出登录
    </Button>
  </View>
</View>
```

删除 `import "./index.css"` 和 `pages/index/index.css`，业务条件与事件处理保持原样。

- [ ] **Step 5: 迁移认证页并删除页面 CSS**

认证页使用：

```tsx
<View className="box-border flex min-h-screen items-center justify-center bg-surface-muted px-section py-page-y">
  <View className="box-border w-full rounded-card bg-white px-section py-page shadow-card">
    <Text className="block text-heading font-bold text-ink-strong">登录 PetCare 宠伴</Text>
    <Text className="mt-note block text-description text-muted-brand">
      登录后可发布需求、接单并管理你的宠物服务。
    </Text>
    <Button className="mt-section rounded-button border-none bg-brand text-white">微信登录</Button>
    <Text className="mt-compact block text-base text-danger">...</Text>
  </View>
</View>
```

两个按钮复用同一串静态工具类；删除 `import "./index.css"` 和
`pages/auth/index.css`，不得抽出 `@apply` 语义类。

- [ ] **Step 6: 运行页面、源码策略和微信构建**

Run:

```bash
pnpm --filter @petcare/miniapp test -- --runInBand src/pages/index/index.test.tsx src/pages/auth/index.test.tsx
node scripts/style-policy.mjs miniapp
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp typecheck
pnpm --filter @petcare/miniapp build:weapp
```

Expected: 页面测试 PASS；源码无不安全类名；微信构建产物包含 `14px`、`240px`、`12px`，不包含 rem/rpx。

- [ ] **Step 7: 提交**

```bash
git add apps/miniapp/tailwind.config.js apps/miniapp/src/pages/index/index.tsx apps/miniapp/src/pages/index/index.test.tsx apps/miniapp/src/pages/auth/index.tsx apps/miniapp/src/pages/auth/index.test.tsx
git add -u apps/miniapp/src/pages/index/index.css apps/miniapp/src/pages/auth/index.css
git commit -m "refactor(miniapp): 使用 Tailwind 重构页面样式"
```

---

### Task 4: 统一 Admin Tailwind v4 px 设计 token

**Files:**

- Modify: `apps/admin/src/index.css`
- Modify: `apps/admin/package.json`
- Modify: `scripts/style-policy.mjs`
- Modify: `scripts/style-policy.test.mjs`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 的 Admin 样式文件检查和 Task 2 的 `checkAdminOutput()`。
- Produces:
  - `validateAdminTheme(source: string): string[]`
  - Tailwind v4 `--spacing`、`--breakpoint-*`、`--container-*`、`--text-*`、`--radius-*` px token。

- [ ] **Step 1: 写 Admin px 主题失败测试**

在 `scripts/style-policy.test.mjs` 增加：

```javascript
test("Admin 主题定义 14px 基线和 px token", async () => {
  const source = await readFile(resolve(repoRoot, "apps/admin/src/index.css"), "utf8");

  assert.deepEqual(validateAdminTheme(source), []);
});
```

`validateAdminTheme()` 的预期契约：

- 必须存在 `--spacing: 4px`；
- 必须存在 `--text-base: 14px`；
- 必须存在 `--breakpoint-md: 768px` 与 `--breakpoint-lg: 1024px`；
- 必须存在 `--container-md: 448px`；
- 必须存在 `html { font-size: 14px; }`；
- `@theme` 块中不得出现 `rem` 或 `rpx`。

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
node --test scripts/style-policy.test.mjs
```

Expected: FAIL，当前 `--radius` 仍为 `0.5rem` 且缺少 px token。

- [ ] **Step 3: 安装 Admin Sass 并实现主题校验**

Run:

```bash
pnpm --filter @petcare/admin add -D sass@1.102.0
```

在 `style-policy.mjs` 导出 `validateAdminTheme()`，按 Step 1 的六条契约返回错误。
该函数只校验 Tailwind 基础设施文件，不允许 SCSS 处理 Tailwind 指令。

- [ ] **Step 4: 将 Admin 主题改为 px**

在 `@theme` 的颜色定义之前增加：

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

将 `@theme` 与 `:root` 中的 `--radius: 0.5rem` 都改为 `--radius: 8px`。保留现有
颜色、dark theme、CSS-first `@import "tailwindcss"` 和基础层 `@apply`；不创建 Admin
页面 SCSS。

Admin 构建脚本改为：

```json
"build": "tsc --noEmit && vite build && node ../../scripts/style-output-policy.mjs admin dist"
```

- [ ] **Step 5: 运行 Admin 策略、测试、类型与构建**

Run:

```bash
node --test scripts/style-policy.test.mjs scripts/style-output-policy.test.mjs
node scripts/style-policy.mjs admin
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin build
```

Expected: 策略和单测 PASS；Admin 构建 CSS 包含 `font-size:14px`，不包含 rem/rpx。

- [ ] **Step 6: 提交**

```bash
git add apps/admin/src/index.css apps/admin/package.json scripts/style-policy.mjs scripts/style-policy.test.mjs pnpm-lock.yaml
git commit -m "refactor(admin): 统一 Tailwind px 样式体系"
```

---

### Task 5: 接入质量门禁、完善文档并全量验收

**Files:**

- Modify: `package.json`
- Modify: `apps/miniapp/package.json`
- Modify: `apps/admin/package.json`
- Modify: `.vscode/settings.json`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Create: `docs/09-development-guidelines/04-styling-standards.md`
- Modify: `docs/INDEX.md`
- Modify: `docs/superpowers/specs/2026-07-28-tailwind-styling-system-design.md`

**Interfaces:**

- Consumes: Tasks 1–4 的源码检查器、产物检查器和双端构建。
- Produces: 根目录 `pnpm lint:styles`、双端 `lint:styles` 和可持续维护的样式规范。

- [ ] **Step 1: 写工作区命令失败测试**

在 `scripts/style-policy.test.mjs` 增加真实 package 契约：

```javascript
test("双端和根目录均接入样式门禁", async () => {
  const rootPackage = await readJson(resolve(repoRoot, "package.json"));
  const miniappPackage = await readJson(resolve(repoRoot, "apps/miniapp/package.json"));
  const adminPackage = await readJson(resolve(repoRoot, "apps/admin/package.json"));

  assert.equal(rootPackage.scripts["lint:styles"], "node scripts/style-policy.mjs all");
  assert.match(rootPackage.scripts["test:tooling"], /style-policy\.test\.mjs/);
  assert.match(rootPackage.scripts["test:tooling"], /style-output-policy\.test\.mjs/);
  assert.equal(
    miniappPackage.scripts["lint:styles"],
    "node ../../scripts/style-policy.mjs miniapp",
  );
  assert.equal(adminPackage.scripts["lint:styles"], "node ../../scripts/style-policy.mjs admin");
  assert.equal(miniappPackage.devDependencies.sass, "1.102.0");
  assert.equal(adminPackage.devDependencies.sass, "1.102.0");
});
```

- [ ] **Step 2: 运行契约测试确认失败**

Run:

```bash
node --test scripts/style-policy.test.mjs
```

Expected: FAIL，三个 package 尚未完整接入样式命令。

- [ ] **Step 3: 接入 package 与 lint-staged**

根目录增加：

```json
"lint:styles": "node scripts/style-policy.mjs all"
```

根目录 `lint` 改为：

```json
"lint": "pnpm lint:styles && turbo run lint"
```

将两个策略测试加入 `test:tooling`。Miniapp 和 Admin 均增加 `lint:styles`，各自的 `lint`
改为 `pnpm lint:styles && eslint .`。

lint-staged 增加：

```json
"apps/admin/src/**/*.{css,scss}": [
  "corepack pnpm --filter @petcare/admin exec -- prettier --write"
],
"apps/miniapp/**/*.{css,scss}": [
  "corepack pnpm --filter @petcare/miniapp exec -- prettier --write"
]
```

删除旧的 Miniapp `**/*.css` 单独规则，避免重复匹配。

- [ ] **Step 4: 完善编辑器配置**

`.vscode/settings.json` 增加：

```json
"scss.lint.unknownAtRules": "ignore"
```

保留 Admin CSS-first 和 Miniapp `tailwind.config.js` 的
`tailwindCSS.experimental.configFile` 映射，不把所有 SCSS 强制关联成普通 CSS。

- [ ] **Step 5: 编写样式规范文档**

创建 `docs/09-development-guidelines/04-styling-standards.md`，必须完整记录：

- Miniapp v3 + `WeappTailwindcss`，Admin v4 CSS-first；
- `14px` 默认字体与“自适应容器 + px token”含义；
- Miniapp 禁止和允许示例；
- `h-mm`、`h-[20px]`、`h-1/2`、`h-20px` 对照；
- token 命名优先级；
- Miniapp `app.scss` 与 Admin 独立 SCSS 的边界；
- `pnpm lint:styles`、双端构建和产物校验命令；
- 微信开发者工具如样式不刷新，应关闭“代码自动热重载”后使用 Taro watch。

在 `docs/INDEX.md` 开发规范表和前端必读列表加入该文档。在 `AGENTS.md` 增加精简强制规则；
在 `README.md` 增加样式检查命令和文档链接。

- [ ] **Step 6: 更新当前 API 更正说明**

确保设计文档写明：

```text
weapp-tailwindcss@5 使用 WeappTailwindcss；
cssOptions.rem2rpx=false；
cssOptions.px2rpx=false；
Miniapp/H5 均注册；
不重复注册 PostCSS Tailwind；
不执行旧版 weapp-tw patch。
```

- [ ] **Step 7: 运行文档、策略和局部质量检查**

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

Expected: 所有测试、双端构建、格式和差异检查通过。

- [ ] **Step 8: 运行完整质量门禁**

Run:

```bash
pnpm check
pnpm test:coverage
```

Expected:

- 根目录格式、样式策略、ESLint、类型检查、全部单元测试和构建通过；
- Miniapp 最终 WXSS 保持 `14px` 且不含 rem/rpx；
- Admin 最终 CSS 使用 px token 且不含 rem/rpx；
- 覆盖率命令退出码为 0；
- 构建与测试不遗留未跟踪产物。

- [ ] **Step 9: 提交规范和质量门禁**

```bash
git add package.json apps/miniapp/package.json apps/admin/package.json scripts/style-policy.test.mjs .vscode/settings.json AGENTS.md README.md docs/09-development-guidelines/04-styling-standards.md docs/INDEX.md docs/superpowers/specs/2026-07-28-tailwind-styling-system-design.md
git commit -m "docs: 完善双端 Tailwind 开发规范"
```

- [ ] **Step 10: 最终状态检查**

Run:

```bash
git status --short
git log -6 --oneline
```

Expected: 工作树干净；设计修正和五个实现提交均使用中文 Conventional Commits。

---

## 官方实现依据

- [weapp-tailwindcss Taro v3/v4 接入](https://tw.icebreaker.top/docs/quick-start/frameworks/taro)
- [weapp-tailwindcss Monorepo 配置](https://tw.icebreaker.top/docs/issues/monorepo)
- [weapp-tailwindcss CSS 单位转换](https://tw.icebreaker.top/docs/quick-start/css-unit-transform)
- [Tailwind CSS v4 兼容性与 Sass 边界](https://tailwindcss.com/docs/compatibility)
