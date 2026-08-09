# UniApp Engineering Configuration Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/uniapp` consume PetCare's shared ESLint rules and root Prettier policy without replacing UniHelper's Vue/UniApp parser stack or formatting vendored/generated sources.

**Architecture:** Keep `@petcare/eslint-config-base` backward-compatible while extracting its common rule map into a parser-free factory that can register the same plugin implementations under caller-selected aliases. Compose that factory after `@uni-helper/eslint-config` in UniApp, and use the root Prettier config plus an explicit root ignore path as the only formatting policy. Fix the repository commit check first so Vue projects run their declared `vue-tsc` typecheck instead of raw `tsc`.

**Tech Stack:** Node.js 22, pnpm 11 workspaces, ESLint 9 flat config, `@uni-helper/eslint-config`, `typescript-eslint` 8, Prettier 3.9.0, Vue 3, `vue-tsc`, Node test runner.

## Global Constraints

- Preserve the existing default export of `@petcare/eslint-config-base`; Admin, Miniapp, Server, and root ESLint configurations must not require rewrites.
- UniApp keeps UniHelper/Antfu, Vue, UniApp, and UnoCSS parsing/configuration; the PetCare factory must not set `languageOptions.parser`.
- Use aliases `petcare-ts`, `petcare-unicorn`, and `petcare-import` in UniApp to prevent flat-config plugin redefinition.
- The only UniApp compatibility overrides are `no-console: off` and `petcare-import/named: off`.
- Root `.prettierrc.json` and `.editorconfig` remain the only formatting rule sources; do not add a UniApp `.prettierrc`.
- UniApp package scripts must pass `--ignore-path ../../.prettierignore`, because Prettier does not search parent directories for ignore files.
- Never format `apps/uniapp/src/uni_modules/**`, `auto-imports.d.ts`, `components.d.ts`, or `uni-pages.d.ts`.
- Keep engineering/configuration changes separate from the mechanical formatting commit.
- Do not migrate Taro business code, remove official starter demos, extend the Admin/Miniapp Tailwind style policy, or run H5/WeChat/Android/iOS builds.

---

## File Map

- `scripts/commit-check.mjs`: run each workspace's declared `typecheck` script so Vue uses `vue-tsc`.
- `scripts/repository-policy.test.mjs`: lock the commit-check and lint-staged repository policies.
- `packages/eslint-config-base/index.js`: own the canonical PetCare rule map and expose `createBaseRulesConfig`.
- `scripts/uniapp-engineering-config.test.mjs`: test parser-free aliases, UniApp effective ESLint config, package scripts, and Prettier exclusions.
- `apps/uniapp/eslint.config.mjs`: compose UniHelper with parser-free PetCare rules.
- `apps/uniapp/package.json`: add the shared config dependency and package-level format commands.
- `package.json`: make UniApp lint-staged formatting use root Prettier and cover Markdown/HTML.
- `.prettierignore`: exclude vendored UniApp runtime and generated declarations.
- `pnpm-lock.yaml`: record only the new UniApp workspace dependency relationship and necessary peer closure.
- `apps/uniapp/**/*.{js,mjs,ts,vue,css,scss,json,md,html}`: mechanical Prettier/ESLint fixes, excluding the protected paths above.

---

### Task 1: Make commit checks use workspace typecheck scripts

**Files:**

- Modify: `scripts/repository-policy.test.mjs`
- Modify: `scripts/commit-check.mjs`
- Commit documentation: `docs/superpowers/specs/2026-08-09-uniapp-engineering-sync-design.md`
- Commit documentation: `docs/superpowers/plans/2026-08-09-uniapp-engineering-sync.md`

**Interfaces:**

- Consumes: each workspace manifest's existing `scripts.typecheck` contract.
- Produces: `runTypechecks()` invoking `corepack pnpm --filter <workspace> run typecheck` for every listed workspace.

- [ ] **Step 1: Strengthen the repository policy test**

Replace the current raw-compiler assertion in the hooks test with:

```js
assert.match(commitCheck, /\["--filter", project, "run", "typecheck"\]/);
assert.doesNotMatch(commitCheck, /typescript\/bin\/tsc|--noEmit/);
```

- [ ] **Step 2: Run the focused test and observe the existing bug**

Run: `node --test scripts/repository-policy.test.mjs`

Expected: FAIL because `scripts/commit-check.mjs` still resolves `node_modules/typescript/bin/tsc` and passes `--noEmit` directly.

- [ ] **Step 3: Route typechecks through workspace scripts**

Change the project list to workspace names and replace `runTypechecks()` with:

```js
const typecheckProjects = [
  "@petcare/admin",
  "@petcare/miniapp",
  "@petcare/uniapp",
  "@petcare/server",
  "@petcare/api-client",
  "@petcare/shared-types",
  "@petcare/shared-utils",
];

async function runTypechecks() {
  for (const project of typecheckProjects) {
    await runPnpm(`${project} 类型检查`, ["--filter", project, "run", "typecheck"]);
  }
}
```

Remove the unused `resolve(directory, ...)` and `project` metadata logic, while retaining root resolution for other commands.

- [ ] **Step 4: Verify the focused policy and UniApp typecheck**

Run:

```bash
node --test scripts/repository-policy.test.mjs
pnpm --filter @petcare/uniapp typecheck
```

Expected: repository policy passes; UniApp runs `vue-tsc --noEmit` and passes.

- [ ] **Step 5: Commit the approved design and implementation plan**

Stage only the two documentation files while the corrected commit-check remains available in the working tree:

```bash
git add docs/superpowers/specs/2026-08-09-uniapp-engineering-sync-design.md docs/superpowers/plans/2026-08-09-uniapp-engineering-sync.md
git commit -m "docs(uniapp): 设计工程化配置统一方案"
```

Expected: the pre-commit typecheck reaches UniApp through `vue-tsc`; the documentation commit succeeds without including code changes.

- [ ] **Step 6: Commit the commit-check correction**

```bash
git add scripts/commit-check.mjs scripts/repository-policy.test.mjs
git commit -m "fix(repo): 按工作区脚本执行类型检查"
```

---

### Task 2: Expose a parser-free shared ESLint rule factory

**Files:**

- Modify: `packages/eslint-config-base/index.js`
- Create: `scripts/uniapp-engineering-config.test.mjs`

**Interfaces:**

- Consumes: existing canonical ESLint rules and plugin implementations in `@petcare/eslint-config-base`.
- Produces: `createBaseRulesConfig(options)` where `options.files?: string[]`, `options.pluginAliases?: Record<string, string>`, and `options.ruleOverrides?: Record<string, unknown>`; returns one parser-free flat config object.

- [ ] **Step 1: Add a failing factory contract test**

Create `scripts/uniapp-engineering-config.test.mjs` with this initial contract:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { createBaseRulesConfig } from "../packages/eslint-config-base/index.js";

test("shared ESLint rules can be consumed without replacing the caller parser", () => {
  const config = createBaseRulesConfig({
    files: ["**/*.{ts,vue}"],
    pluginAliases: {
      "@typescript-eslint": "petcare-ts",
      unicorn: "petcare-unicorn",
      import: "petcare-import",
    },
    ruleOverrides: {
      "no-console": "off",
      "import/named": "off",
    },
  });

  assert.deepEqual(config.files, ["**/*.{ts,vue}"]);
  assert.equal(config.languageOptions?.parser, undefined);
  assert.deepEqual(Object.keys(config.plugins).sort(), [
    "petcare-import",
    "petcare-ts",
    "petcare-unicorn",
  ]);
  assert.equal(config.rules["petcare-ts/no-explicit-any"], "error");
  assert.equal(config.rules["petcare-unicorn/prefer-includes"], "error");
  assert.equal(config.rules["petcare-import/order"][0], "error");
  assert.equal(config.rules["petcare-import/named"], "off");
  assert.equal(config.rules["no-console"], "off");
});
```

- [ ] **Step 2: Run the contract test and verify the missing export**

Run: `node --test scripts/uniapp-engineering-config.test.mjs`

Expected: FAIL because `createBaseRulesConfig` is not exported.

- [ ] **Step 3: Extract the canonical rule map and implement alias rewriting**

In `packages/eslint-config-base/index.js`, move the existing custom `rules` object to `const baseRules`, define plugin implementations, and add:

```js
const rulePlugins = {
  "@typescript-eslint": tseslint.plugin,
  unicorn: eslintPluginUnicorn,
  import: eslintPluginImport,
};

function rewriteRuleId(ruleId, aliases) {
  for (const [pluginName, alias] of Object.entries(aliases)) {
    if (ruleId.startsWith(`${pluginName}/`)) {
      return `${alias}/${ruleId.slice(pluginName.length + 1)}`;
    }
  }
  return ruleId;
}

function rewriteRules(rules, aliases) {
  return Object.fromEntries(
    Object.entries(rules).map(([ruleId, setting]) => [rewriteRuleId(ruleId, aliases), setting]),
  );
}

export function createBaseRulesConfig({
  files = ["**/*.{ts,tsx,js,jsx}"],
  pluginAliases = {},
  ruleOverrides = {},
} = {}) {
  const aliases = Object.fromEntries(
    Object.keys(rulePlugins).map((pluginName) => [
      pluginName,
      pluginAliases[pluginName] ?? pluginName,
    ]),
  );

  return {
    files,
    plugins: Object.fromEntries(
      Object.entries(rulePlugins).map(([pluginName, plugin]) => [aliases[pluginName], plugin]),
    ),
    rules: {
      ...rewriteRules(baseRules, aliases),
      ...rewriteRules(ruleOverrides, aliases),
    },
  };
}
```

Keep the existing default export structure, parser, and plugin registrations intact; have its final config reference `baseRules` so current consumers get the same rules.

- [ ] **Step 4: Verify factory and backward compatibility**

Run:

```bash
node --test scripts/uniapp-engineering-config.test.mjs
pnpm --filter @petcare/eslint-config-base lint
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/miniapp lint
```

Expected: all commands pass; Admin and Miniapp need no ESLint config edits.

- [ ] **Step 5: Leave this task uncommitted until Task 4 source fixes make the full hook green**

Do not bypass hooks. Keep the tested Task 2 changes in the working tree; Task 4 will make UniApp lint/format green before the configuration commit is created.

---

### Task 3: Compose PetCare rules into UniApp

**Files:**

- Modify: `apps/uniapp/eslint.config.mjs`
- Modify: `apps/uniapp/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/uniapp-engineering-config.test.mjs`

**Interfaces:**

- Consumes: `createBaseRulesConfig` from Task 2.
- Produces: an effective UniApp flat config that keeps Vue parsing and exposes PetCare rules as `petcare-*` rule IDs.

- [ ] **Step 1: Extend the test to calculate effective TS and Vue configs**

Append:

```js
import { ESLint } from "eslint";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const uniappRoot = resolve(root, "apps/uniapp");

test("UniApp composes Vue parsing with PetCare rules", async () => {
  const eslint = new ESLint({ cwd: uniappRoot, overrideConfigFile: "eslint.config.mjs" });
  const mainConfig = await eslint.calculateConfigForFile("src/main.ts");
  const appConfig = await eslint.calculateConfigForFile("src/App.vue");

  assert.ok(mainConfig.plugins["petcare-ts"]);
  assert.ok(appConfig.plugins["petcare-unicorn"]);
  assert.equal(mainConfig.rules["petcare-ts/no-explicit-any"][0], 2);
  assert.equal(appConfig.rules.semi[0], 2);
  assert.equal(appConfig.rules["petcare-import/named"][0], 0);
  assert.match(appConfig.languageOptions.parser.meta.name, /vue-eslint-parser/);
});
```

- [ ] **Step 2: Run the test and verify UniApp does not yet consume PetCare rules**

Run: `node --test scripts/uniapp-engineering-config.test.mjs`

Expected: the factory test passes and the effective-config test fails because `petcare-ts` is absent.

- [ ] **Step 3: Compose the parser-free config after UniHelper**

Update `apps/uniapp/eslint.config.mjs` to import the factory and pass this user config after the UniHelper options:

```js
const petcareRules = createBaseRulesConfig({
  files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,vue}"],
  pluginAliases: {
    "@typescript-eslint": "petcare-ts",
    unicorn: "petcare-unicorn",
    import: "petcare-import",
  },
  ruleOverrides: {
    // Official starter demos intentionally log CI, router, request, and theme behavior.
    "no-console": "off",
    // UniApp virtual modules and conditional exports cannot be resolved reliably by static analysis.
    "import/named": "off",
  },
});

export default uni(
  {
    unocss: true,
    rules: {
      "eslint-comments/no-unlimited-disable": "off",
    },
    ignores: ["src/uni_modules/**/*", "docs/.vitepress/dist", "docs/.vitepress/cache", "**/*.md"],
  },
  petcareRules,
);
```

- [ ] **Step 4: Add the workspace dependency and update the lockfile**

Add to UniApp `devDependencies`:

```json
"@petcare/eslint-config-base": "workspace:*"
```

Run: `pnpm install --frozen-lockfile=false`

Expected: install succeeds and the UniApp importer in `pnpm-lock.yaml` records the workspace link; unrelated importer specifiers do not change.

- [ ] **Step 5: Verify effective config creation**

Run:

```bash
node --test scripts/uniapp-engineering-config.test.mjs
pnpm --filter @petcare/uniapp exec eslint --print-config src/main.ts
pnpm --filter @petcare/uniapp exec eslint --print-config src/App.vue
```

Expected: test passes and neither print-config command reports plugin redefinition or parser errors.

---

### Task 4: Unify Prettier policy and migrate UniApp sources

**Files:**

- Modify: `.prettierignore`
- Modify: `package.json`
- Modify: `apps/uniapp/package.json`
- Modify: `scripts/uniapp-engineering-config.test.mjs`
- Modify mechanically: allowed files under `apps/uniapp/`

**Interfaces:**

- Consumes: root `.prettierrc.json`, root `.prettierignore`, and Task 3 ESLint config.
- Produces: package scripts `format`/`format:check`, root-cwd lint-staged formatting, and a clean UniApp source tree.

- [ ] **Step 1: Add failing formatting-policy assertions**

Append a test that reads both manifests and `.prettierignore`:

```js
import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

test("UniApp uses the root Prettier policy and excludes generated sources", async () => {
  const rootManifest = await readJson("package.json");
  const uniappManifest = await readJson("apps/uniapp/package.json");
  const prettierIgnore = await readFile(resolve(root, ".prettierignore"), "utf8");

  assert.equal(
    uniappManifest.scripts.format,
    "prettier --write . --ignore-path ../../.prettierignore",
  );
  assert.equal(
    uniappManifest.scripts["format:check"],
    "prettier --check . --ignore-path ../../.prettierignore",
  );
  assert.deepEqual(rootManifest["lint-staged"]["apps/uniapp/**/*.{js,mjs,ts,vue}"], [
    "prettier --write",
    "corepack pnpm --filter @petcare/uniapp exec -- eslint . --fix",
  ]);
  assert.deepEqual(rootManifest["lint-staged"]["apps/uniapp/**/*.{md,html}"], ["prettier --write"]);
  for (const path of [
    "apps/uniapp/src/uni_modules/",
    "apps/uniapp/src/auto-imports.d.ts",
    "apps/uniapp/src/components.d.ts",
    "apps/uniapp/src/uni-pages.d.ts",
  ]) {
    assert.match(prettierIgnore, new RegExp(`^${path.replaceAll(".", "\\.")}$`, "m"));
  }
});
```

- [ ] **Step 2: Run the test and verify all formatting contracts are absent**

Run: `node --test scripts/uniapp-engineering-config.test.mjs`

Expected: FAIL on the missing UniApp format scripts or ignore entries.

- [ ] **Step 3: Implement root formatting boundaries**

Append these exact entries to `.prettierignore`:

```text
# UniApp vendored and generated sources
apps/uniapp/src/uni_modules/
apps/uniapp/src/auto-imports.d.ts
apps/uniapp/src/components.d.ts
apps/uniapp/src/uni-pages.d.ts
```

Add the two package scripts from the test. In root lint-staged, change UniApp Prettier commands to `prettier --write` and add the `apps/uniapp/**/*.{md,html}` entry. Do not add AXML.

- [ ] **Step 4: Run the mechanical formatter over the allowed UniApp scope**

Run from the repository root:

```bash
node_modules/.bin/prettier --write apps/uniapp --ignore-path .prettierignore
pnpm --filter @petcare/uniapp lint:fix
```

Expected: double quotes, semicolons, line wrapping, import ordering, and other fixable rules are normalized without touching protected paths.

- [ ] **Step 5: Fix only remaining semantic lint violations**

Run: `pnpm --filter @petcare/uniapp lint`

For each remaining error, apply the narrow source correction required by the reported rule. Replace explicit `any` with the actual local type or `unknown` plus narrowing; extract helpers only when `petcare-unicorn/consistent-function-scoping` proves they do not capture component state; do not disable additional rules or change demo behavior.

- [ ] **Step 6: Verify protected sources were not modified**

Run:

```bash
git diff --name-only -- apps/uniapp/src/uni_modules apps/uniapp/src/auto-imports.d.ts apps/uniapp/src/components.d.ts apps/uniapp/src/uni-pages.d.ts
```

Expected: no output.

- [ ] **Step 7: Verify engineering configuration before committing**

Run:

```bash
node --test scripts/repository-policy.test.mjs scripts/workspace-contract.test.mjs scripts/uniapp-engineering-config.test.mjs
pnpm --filter @petcare/eslint-config-base lint
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/uniapp lint
pnpm --filter @petcare/uniapp typecheck
pnpm --filter @petcare/uniapp test
pnpm --filter @petcare/uniapp format:check
```

Expected: all commands pass.

- [ ] **Step 8: Commit engineering configuration and tests**

Stage only configuration, tests, manifests, and lockfile:

```bash
git add .prettierignore package.json pnpm-lock.yaml packages/eslint-config-base/index.js apps/uniapp/eslint.config.mjs apps/uniapp/package.json scripts/uniapp-engineering-config.test.mjs
git commit -m "chore(uniapp): 统一 ESLint 与 Prettier 配置"
```

- [ ] **Step 9: Commit mechanical source normalization separately**

Review `git diff --stat` and `git diff -- apps/uniapp` to confirm only formatter/linter-driven source edits remain, then run:

```bash
git add apps/uniapp
git commit -m "style(uniapp): 统一项目代码格式"
```

---

### Task 5: Final repository verification

**Files:**

- Verify only; modify a file only when a command identifies a defect introduced by Tasks 1-4.

**Interfaces:**

- Consumes: all prior task deliverables.
- Produces: evidence that repository policy, existing consumers, and UniApp quality gates pass without platform builds.

- [ ] **Step 1: Run tooling and formatting checks**

```bash
node --test scripts/repository-policy.test.mjs scripts/workspace-contract.test.mjs scripts/uniapp-engineering-config.test.mjs
pnpm format:check
git diff --check
```

- [ ] **Step 2: Run affected workspace lint/type/test checks**

```bash
pnpm --filter @petcare/eslint-config-base lint
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/uniapp lint
pnpm --filter @petcare/uniapp typecheck
pnpm --filter @petcare/uniapp test
```

- [ ] **Step 3: Inspect branch scope**

```bash
git status --short
git diff 66c7dcb..HEAD --stat
git diff 66c7dcb..HEAD --name-only
```

Expected: clean working tree; only the files described in this plan changed; no `apps/miniapp` business code, UniApp vendor/generated files, or four-platform build outputs appear.

- [ ] **Step 4: Record deliberately skipped validation**

In the final handoff, explicitly state that H5, WeChat Mini Program, Android, and iOS builds were not run at the user's request. Do not infer platform-build success from lint or typecheck.
