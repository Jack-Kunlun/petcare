# UniApp 工程化配置统一设计

## 1. 目标

将 `apps/uniapp` 纳入 PetCare monorepo 的统一工程化边界：

- ESLint 复用 `@petcare/eslint-config-base` 中的项目规则，同时保留 Vue、UniApp 和 UnoCSS 所需解析能力。
- Prettier 使用仓库根配置，根级 `format:check`、lint-staged 与 CI 对 UniApp 得到一致结果。
- 将首次格式化产生的大规模机械 diff 与配置、测试改动分开提交。
- 不迁移业务、不删官方示例、不运行 H5/微信/Android/iOS 四端构建。

## 2. 已确认现状

### 2.1 ESLint

- `packages/eslint-config-base/index.js` 是共享基础配置，包含通用 JavaScript、TypeScript、Unicorn 和 Import 规则。
- `apps/admin` 与 `apps/miniapp` 已直接继承该默认 flat config。
- `apps/uniapp/eslint.config.mjs` 目前只使用 `@uni-helper/eslint-config`，没有使用 PetCare 基础规则。
- 共享默认配置不能直接传给 UniHelper：`typescript-eslint/base` 会注册 parser/plugin，而 UniHelper/Antfu 已注册自己的 TypeScript plugin。只做数组拼接会触发 `Cannot redefine plugin "ts"`，并可能覆盖 Vue parser。

### 2.2 Prettier

- 根 `.prettierrc.json` 已定义双引号、分号、2 空格、`printWidth: 100`、LF 等统一规则。
- 根 `format`/`format:check` 会扫描整个仓库，但当前 UniApp 有 91 个文件不符合根规则，导致根 `format:check` 失败。
- UniApp 没有自己的 Prettier 配置或 format scripts；lint-staged 虽已覆盖常用 UniApp 文件，但执行路径依赖 filtered package 的 Prettier。
- `src/uni_modules/**` 是 vendored runtime；`auto-imports.d.ts`、`components.d.ts`、`uni-pages.d.ts` 是插件生成声明，不应参与机械格式化。

## 3. 方案比较

### 方案 A：直接拼接默认基础配置

```js
uni(options, ...baseConfig);
```

优点是改动少；缺点是已验证会发生 TypeScript plugin 重复注册，并存在 Vue parser 被覆盖的风险。拒绝采用。

### 方案 B：复制基础规则到 UniApp

优点是可以快速绕开 plugin 冲突；缺点是形成第二份规则源，未来基础配置变化不会同步。拒绝采用。

### 方案 C：共享包提供 parser-free 规则配置工厂（采用）

基础包保留现有默认导出，继续服务 Admin、Miniapp 和 Server；另外提供一个不设置 parser 的规则配置工厂。UniApp 使用独立 plugin alias 消费这组规则，因此既复用同一规则源，又不覆盖 UniHelper 的 Vue/TypeScript parser。

## 4. ESLint 设计

### 4.1 共享包接口

`packages/eslint-config-base/index.js` 增加命名导出：

```js
createBaseRulesConfig({ files, pluginAliases, ruleOverrides });
```

职责：

- 复用当前默认配置中的同一份通用、TypeScript、Unicorn 和 Import 规则对象。
- 按传入 alias 重写 plugin rule ID 并注册对应 plugin 实现。
- 返回一个 parser-free flat config；不得设置 `languageOptions.parser`。
- 默认导出及现有消费者接口保持兼容，不要求 Admin、Miniapp、Server 改写配置。

UniApp 使用独立 alias：

```text
@typescript-eslint -> petcare-ts
unicorn            -> petcare-unicorn
import             -> petcare-import
```

独立 alias 避免与 Antfu 已注册的 `ts`、`unicorn`、`import` plugin 实例冲突。

### 4.2 UniApp 组合顺序

`apps/uniapp/eslint.config.mjs` 保留 `uni(...)` 为顶层 composer，并把 `createBaseRulesConfig(...)` 作为后置 user config：

```text
UniHelper/Antfu 基础解析与规则
  -> UniApp/Vue/UnoCSS 配置
  -> PetCare parser-free 共享规则
  -> 少量有证据的 UniApp 兼容覆盖
```

共享规则应用于：

```text
**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}
```

这样 `.vue` 仍由 Vue parser 解析，但其 script 内容也接受 PetCare 通用质量规则。

### 4.3 允许的兼容覆盖

只保留两类有证据的覆盖，并在配置中写明原因：

- `no-console: off`：官方 starter 的 CI、router、request、theme 等演示页有大量显式日志；在示例页清理前保留现状，避免为了 lint 删除演示行为。
- `petcare-import/named: off`：UniApp 虚拟模块和条件导出无法被 `eslint-plugin-import` 可靠静态解析，与现有 Taro/React 消费端的处理一致。

除上述覆盖外，不为通过 lint 批量关闭 `no-explicit-any`、Unicorn 或通用质量规则；实际违规应修复。

### 4.4 依赖

- `apps/uniapp` 增加 `@petcare/eslint-config-base: workspace:*`。
- 保留 UniHelper、ESLint 与 UnoCSS ESLint 依赖。
- 共享配置工厂内部提供 plugin 实现并使用独立 alias；UniApp 不重复直接组装 parser。
- 更新 `pnpm-lock.yaml`，但不得升级无关依赖。

## 5. Prettier 设计

### 5.1 单一配置源

- UniApp 不新增 `.prettierrc`。
- 所有格式规则来自根 `.prettierrc.json` 与 `.editorconfig`。
- `apps/uniapp/package.json` 增加：

```json
{
  "format": "prettier --write . --ignore-path ../../.prettierignore",
  "format:check": "prettier --check . --ignore-path ../../.prettierignore"
}
```

- 保留与根完全相同的 `prettier: 3.9.0`，保证 filtered package scripts 在 pnpm 下可独立运行。
- Prettier 会向上查找配置文件，但默认只从命令执行目录读取 ignore 文件；因此 UniApp scripts 必须显式传入根 `../../.prettierignore`。

### 5.2 排除边界

根 `.prettierignore` 增加：

```text
apps/uniapp/src/uni_modules/
apps/uniapp/src/auto-imports.d.ts
apps/uniapp/src/components.d.ts
apps/uniapp/src/uni-pages.d.ts
```

不排除 `pages.json`、`manifest.json` 或普通 Vue/TS/JSON/Markdown 文件；它们属于项目可审查源码或配置。

### 5.3 lint-staged

- UniApp 的 Prettier 命令改为直接使用根 `prettier --write`，确保读取根 `.prettierrc.json` 和 `.prettierignore`。
- ESLint 仍使用 `pnpm --filter @petcare/uniapp exec -- eslint . --fix`，确保加载 UniApp flat config。
- 补齐 UniApp 可格式化的 Markdown/HTML 文件匹配；Axml 当前没有稳定的 Prettier parser，不纳入自动格式化。

## 6. 首次迁移策略

首次统一分为两个提交：

1. **工程配置与测试提交**：共享 ESLint API、UniApp ESLint 组合、Prettier ignore、scripts、lint-staged、依赖与契约测试。
2. **纯机械格式化提交**：使用根 Prettier 格式化允许范围，再运行 UniApp ESLint `--fix`；人工修复剩余语义规则问题。

禁止在机械格式化提交中混入业务逻辑改造。必须通过 diff 检查确认没有修改 `src/uni_modules/**` 和生成声明文件。

## 7. 测试与验收

### 7.1 配置契约测试

新增或扩展 Node tooling tests，验证：

- `createBaseRulesConfig` 不设置 parser。
- plugin aliases 与 rule ID 重写正确。
- UniApp config 能分别计算 `src/main.ts` 与 `src/App.vue` 的有效配置，没有 plugin 重定义错误。
- 两类文件均获得代表性 PetCare 规则；Vue parser 仍生效。
- UniApp 暴露 `format` 与 `format:check` scripts。
- lint-staged 使用根 Prettier，并继续调用 UniApp ESLint。
- vendored/generated 路径由根 `.prettierignore` 排除。

### 7.2 最终命令

```bash
node --test scripts/repository-policy.test.mjs scripts/workspace-contract.test.mjs <新增配置契约测试>
pnpm --filter @petcare/eslint-config-base lint
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/uniapp lint
pnpm --filter @petcare/uniapp typecheck
pnpm --filter @petcare/uniapp test
pnpm --filter @petcare/uniapp format:check
pnpm format:check
git diff --check
```

不运行 H5、微信、Android、iOS 构建。

## 8. 风险与控制

- **Plugin 重定义**：通过 parser-free 工厂与独立 alias 消除，并用 ESLint API 合同测试锁定。
- **大规模格式 diff 隐藏语义改动**：格式化独立提交，禁止 vendor/generated 进入 diff。
- **UniApp 虚拟模块误报**：仅关闭有证据的 `petcare-import/named`。
- **格式工具漂移**：根与 UniApp 固定相同 Prettier 版本，根配置为唯一规则源。
- **无关依赖升级**：锁文件只允许新增 workspace base 关系与必要 peer closure。

## 9. 非目标

- 不迁移 Taro 业务线。
- 不删除官方 wot-starter-v2 示例、Mock 或演示页面。
- 不把 UniApp 纳入现有仅针对 Admin/Miniapp 的 Tailwind 样式策略。
- 不引入新的 formatter、Stylelint 或四端构建流程。
