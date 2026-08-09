# Affected Pre-commit Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unconditional full-repository pre-commit gate with staged-file linting plus affected-workspace typecheck/style checks, while keeping full E2E and build coverage in CI and explicit root commands.

**Architecture:** A pure `commit-scope` module converts staged repository paths into pnpm workspace selectors, a full-typecheck flag, and Admin/Miniapp style scopes. `commit-check` reads NUL-delimited paths from Git index, executes only that scope, and never runs E2E or root full lint. lint-staged is corrected to operate on injected staged paths and protect UniApp vendor/generated sources.

**Tech Stack:** Node.js 22, pnpm 11 workspaces, Git index, Husky 9, lint-staged 17, ESLint 9, Prettier 3.9, Node test runner.

## Global Constraints

- Keep `.husky/pre-commit` as `lint-staged` followed by `commit:check`.
- `commit:check` must never run `pnpm test:e2e`, root `pnpm lint`, build, PostgreSQL, Redis, Prisma, Playwright, or four-platform UniApp builds.
- Direct application changes typecheck only their workspace.
- Shared package changes use pnpm dependents selectors (`...@petcare/<package>`) so consumers are included.
- Root manifest/lock/workspace/Turbo/tsconfig, hook, commit-scope, commit-check, and shared ESLint changes trigger all seven workspace typechecks.
- Admin/Miniapp source changes retain their existing `lint:styles` checks; UniApp does not enter the Tailwind style policy.
- Git staged paths are read with `--name-only --diff-filter=ACMR -z`; staged paths are never interpolated into shell commands.
- Existing CI quality, unit, build, E2E, and Docker jobs remain unchanged.
- lint-staged ESLint commands must not contain `eslint . --fix`.
- UniApp vendor/generated files are protected by root Prettier ignore and UniApp ESLint ignore.
- Do not run Server/Admin E2E, start containers, or run H5/WeChat/Android/iOS builds during implementation.

---

## File Map

- Create `scripts/commit-scope.mjs`: pure staged-path classifier and shared constants.
- Create `scripts/commit-scope.test.mjs`: deterministic path/scope contract tests.
- Modify `scripts/commit-check.mjs`: read Git index and execute classified typecheck/style scope.
- Modify `scripts/repository-policy.test.mjs`: lock lightweight hook behavior and lint-staged boundaries.
- Modify `scripts/ci-policy.test.mjs`: retain/assert CI E2E coverage if the existing assertion is insufficient.
- Modify `package.json`: staged-only ESLint commands and root scripts lint-staged group.
- Modify `.prettierignore`: protect UniApp vendor/generated sources.
- Modify `apps/uniapp/eslint.config.mjs`: protect generated declarations from staged ESLint.

---

### Task 1: Build the pure staged-path classifier

**Files:**

- Create: `scripts/commit-scope.mjs`
- Create: `scripts/commit-scope.test.mjs`

**Interfaces:**

- Produces: `FULL_TYPECHECK_PROJECTS: readonly string[]` and `classifyStagedPaths(paths: string[]): { fullTypecheck: boolean; typecheckSelectors: string[]; styleScopes: string[] }`.
- Consumes: repository-relative path strings using `/` or `\` separators.

- [ ] **Step 1: Write the failing path classification tests**

Create `scripts/commit-scope.test.mjs` with these exact cases:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { FULL_TYPECHECK_PROJECTS, classifyStagedPaths } from "./commit-scope.mjs";

test("a UniApp source change selects only UniApp", () => {
  assert.deepEqual(classifyStagedPaths(["apps/uniapp/src/App.vue"]), {
    fullTypecheck: false,
    typecheckSelectors: ["@petcare/uniapp"],
    styleScopes: [],
  });
});

test("application selectors and style scopes are deduplicated and sorted", () => {
  assert.deepEqual(
    classifyStagedPaths([
      "apps/miniapp/src/pages/index.tsx",
      "apps/admin/src/App.tsx",
      "apps/admin/src/app.css",
    ]),
    {
      fullTypecheck: false,
      typecheckSelectors: ["@petcare/admin", "@petcare/miniapp"],
      styleScopes: ["admin", "miniapp"],
    },
  );
});

test("shared packages include their dependents", () => {
  assert.deepEqual(
    classifyStagedPaths(["packages/shared-types/src/index.ts", "packages/shared-utils/src/date.ts"])
      .typecheckSelectors,
    ["...@petcare/shared-types", "...@petcare/shared-utils"],
  );
});

test("root and shared lint configuration changes require all workspace typechecks", () => {
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    "tsconfig.base.json",
    "packages/eslint-config-base/index.js",
    ".husky/pre-commit",
    "scripts/commit-check.mjs",
    "scripts/commit-scope.mjs",
  ]) {
    const scope = classifyStagedPaths([path]);
    assert.equal(scope.fullTypecheck, true, path);
    assert.deepEqual(scope.typecheckSelectors, []);
  }

  assert.deepEqual(FULL_TYPECHECK_PROJECTS, [
    "@petcare/admin",
    "@petcare/miniapp",
    "@petcare/uniapp",
    "@petcare/server",
    "@petcare/api-client",
    "@petcare/shared-types",
    "@petcare/shared-utils",
  ]);
});

test("Windows separators and empty input are supported", () => {
  assert.deepEqual(classifyStagedPaths(["apps\\uniapp\\src\\main.ts"]), {
    fullTypecheck: false,
    typecheckSelectors: ["@petcare/uniapp"],
    styleScopes: [],
  });
  assert.deepEqual(classifyStagedPaths([]), {
    fullTypecheck: false,
    typecheckSelectors: [],
    styleScopes: [],
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --test scripts/commit-scope.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/commit-scope.mjs`.

- [ ] **Step 3: Implement the pure classifier**

Create `scripts/commit-scope.mjs` with these immutable mappings and implementation:

```js
const DIRECT_WORKSPACES = Object.freeze({
  "apps/admin/": "@petcare/admin",
  "apps/miniapp/": "@petcare/miniapp",
  "apps/uniapp/": "@petcare/uniapp",
  "apps/server/": "@petcare/server",
});

const DEPENDENT_WORKSPACES = Object.freeze({
  "packages/api-client/": "...@petcare/api-client",
  "packages/shared-types/": "...@petcare/shared-types",
  "packages/shared-utils/": "...@petcare/shared-utils",
});

const FULL_SCOPE_PATHS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".husky/pre-commit",
  "scripts/commit-check.mjs",
  "scripts/commit-scope.mjs",
]);

export const FULL_TYPECHECK_PROJECTS = Object.freeze([
  "@petcare/admin",
  "@petcare/miniapp",
  "@petcare/uniapp",
  "@petcare/server",
  "@petcare/api-client",
  "@petcare/shared-types",
  "@petcare/shared-utils",
]);

export function classifyStagedPaths(paths) {
  const normalizedPaths = paths.map((path) => path.replaceAll("\\", "/"));
  const typecheckSelectors = new Set();
  const styleScopes = new Set();
  let fullTypecheck = false;

  for (const path of normalizedPaths) {
    if (
      FULL_SCOPE_PATHS.has(path) ||
      /^tsconfig(?:\.[^/]+)?\.json$/u.test(path) ||
      path.startsWith("packages/eslint-config-base/")
    ) {
      fullTypecheck = true;
    }

    for (const [prefix, selector] of Object.entries(DIRECT_WORKSPACES)) {
      if (path.startsWith(prefix)) typecheckSelectors.add(selector);
    }

    for (const [prefix, selector] of Object.entries(DEPENDENT_WORKSPACES)) {
      if (path.startsWith(prefix)) typecheckSelectors.add(selector);
    }

    if (path.startsWith("apps/admin/src/")) styleScopes.add("admin");
    if (path.startsWith("apps/miniapp/src/")) styleScopes.add("miniapp");
  }

  return {
    fullTypecheck,
    typecheckSelectors: fullTypecheck ? [] : [...typecheckSelectors].sort(),
    styleScopes: [...styleScopes].sort(),
  };
}
```

- [ ] **Step 4: Verify classifier contracts**

Run:

```text
node --test scripts/commit-scope.test.mjs
node node_modules/eslint/bin/eslint.js scripts/commit-scope.mjs scripts/commit-scope.test.mjs
git diff --check
```

Expected: all pass.

- [ ] **Step 5: Keep Task 1 uncommitted until Task 2 replaces the old hook behavior**

Do not run the old pre-commit or start external services. Task 2 consumes these files and creates the first implementation commit under the new hook.

---

### Task 2: Execute only the classified commit scope

**Files:**

- Modify: `scripts/commit-check.mjs`
- Modify: `scripts/repository-policy.test.mjs`
- Test: `scripts/commit-scope.test.mjs`

**Interfaces:**

- Consumes: `FULL_TYPECHECK_PROJECTS` and `classifyStagedPaths(paths)` from Task 1.
- Produces: a pre-commit runner that reads staged paths and invokes only affected typecheck/style commands.

- [ ] **Step 1: Replace the old repository-policy expectations with failing lightweight-gate assertions**

In the hooks policy test, retain assertions that pre-commit invokes lint-staged then commit:check, then require:

```js
assert.match(
  commitCheck,
  /git[\s\S]*diff[\s\S]*--cached[\s\S]*--name-only[\s\S]*--diff-filter=ACMR[\s\S]*-z/,
);
assert.match(commitCheck, /classifyStagedPaths/);
assert.match(commitCheck, /lint:styles/);
assert.doesNotMatch(commitCheck, /\["lint"\]/);
assert.doesNotMatch(commitCheck, /\["test:e2e"\]/);
assert.doesNotMatch(commitCheck, /\bbuild\b/);
```

- [ ] **Step 2: Run the focused policy tests and observe the old full gate**

Run:

```text
node --test scripts/commit-scope.test.mjs scripts/repository-policy.test.mjs
```

Expected: scope tests pass; repository policy fails because commit-check still contains root lint and E2E.

- [ ] **Step 3: Read NUL-delimited staged paths**

Import `execFileSync` from `node:child_process` and implement:

```js
function readStagedPaths() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { cwd: root, encoding: "buffer" },
  );

  return output.toString("utf8").split("\0").filter(Boolean);
}
```

Git failures must propagate to `main().catch` and fail the check.

- [ ] **Step 4: Execute classified typechecks and style scopes**

Replace the fixed loop and root lint/E2E calls with:

```js
function createFilterArguments(selectors) {
  return selectors.flatMap((selector) => ["--filter", selector]);
}

async function runTypechecks(scope) {
  const selectors = scope.fullTypecheck ? FULL_TYPECHECK_PROJECTS : scope.typecheckSelectors;

  if (selectors.length === 0) return;

  await runPnpm("受影响工作区类型检查", [
    ...createFilterArguments(selectors),
    "--if-present",
    "run",
    "typecheck",
  ]);
}

async function runStyleChecks(styleScopes) {
  const packages = {
    admin: "@petcare/admin",
    miniapp: "@petcare/miniapp",
  };

  for (const scope of styleScopes) {
    await runPnpm(`${scope} 样式检查`, ["--filter", packages[scope], "run", "lint:styles"]);
  }
}

async function main() {
  const stagedPaths = readStagedPaths();
  const scope = classifyStagedPaths(stagedPaths);

  await runTypechecks(scope);
  await runStyleChecks(scope.styleScopes);
}
```

Import the classifier/constants. Keep `runCommand`/`runPnpm`; remove obsolete fixed project data and all root lint/E2E calls.

- [ ] **Step 5: Verify lightweight gate behavior without committing**

Run:

```text
node --test scripts/commit-scope.test.mjs scripts/repository-policy.test.mjs scripts/ci-policy.test.mjs
pnpm lint:scripts
git diff --check
```

Expected: all pass; no command requires PostgreSQL, Redis, Prisma, Playwright, or Docker.

- [ ] **Step 6: Commit classifier and runner under the new hook**

Stage only:

```text
scripts/commit-scope.mjs
scripts/commit-scope.test.mjs
scripts/commit-check.mjs
scripts/repository-policy.test.mjs
```

Commit: `fix(repo): 按暂存范围执行提交检查`

Expected: the staged `commit-check`/`commit-scope` paths trigger all seven typechecks but no root lint or E2E.

---

### Task 3: Make lint-staged truly staged-only and protect generated sources

**Files:**

- Modify: `package.json`
- Modify: `.prettierignore`
- Modify: `apps/uniapp/eslint.config.mjs`
- Modify: `scripts/repository-policy.test.mjs`

**Interfaces:**

- Consumes: root Prettier config/ignore and each workspace's ESLint flat config.
- Produces: lint-staged commands that receive filenames from lint-staged instead of scanning `.`.

- [ ] **Step 1: Add failing lint-staged and protected-path assertions**

Extend repository policy to assert:

```js
assert.doesNotMatch(lintStaged, /eslint\s+\.\s+--fix/);
assert.deepEqual(manifest["lint-staged"]["scripts/**/*.{js,mjs,cjs}"], [
  "prettier --write",
  "eslint --fix",
]);
assert.match(prettierIgnore, /^apps\/uniapp\/src\/uni_modules\/$/m);
assert.match(prettierIgnore, /^apps\/uniapp\/src\/auto-imports\.d\.ts$/m);
assert.match(prettierIgnore, /^apps\/uniapp\/src\/components\.d\.ts$/m);
assert.match(prettierIgnore, /^apps\/uniapp\/src\/uni-pages\.d\.ts$/m);
```

Read `.prettierignore` in the test. Also assert the serialized UniApp ESLint config contains all four protected paths.

- [ ] **Step 2: Run the policy test and observe current full-workspace ESLint commands**

Run: `node --test scripts/repository-policy.test.mjs`

Expected: FAIL because multiple commands contain `eslint . --fix`, the scripts group is missing, and ignore entries are absent.

- [ ] **Step 3: Update lint-staged commands**

In root `package.json`:

- Replace every workspace Prettier command with `prettier --write`.
- Replace every `eslint . --fix` with the same filtered `eslint --fix` command.
- Keep Miniapp's existing `eslint --fix` behavior.
- Add:

```json
"scripts/**/*.{js,mjs,cjs}": [
  "prettier --write",
  "eslint --fix"
]
```

Do not add AXML formatting.

- [ ] **Step 4: Protect UniApp generated/vendor files**

Append to root `.prettierignore`:

```text
# UniApp vendored and generated sources
apps/uniapp/src/uni_modules/
apps/uniapp/src/auto-imports.d.ts
apps/uniapp/src/components.d.ts
apps/uniapp/src/uni-pages.d.ts
```

Add the four corresponding paths/globs to the existing UniApp ESLint `ignores` array.

- [ ] **Step 5: Verify policy, effective ignores, and CI boundary**

Run:

```text
node --test scripts/commit-scope.test.mjs scripts/repository-policy.test.mjs scripts/ci-policy.test.mjs
pnpm lint:scripts
pnpm --filter @petcare/uniapp typecheck
git diff --check
```

Expected: all pass; CI policy still proves the E2E job runs `pnpm test:e2e`.

- [ ] **Step 6: Commit staged-only lint configuration**

Stage only Task 3 files and commit:

```text
chore(repo): 收敛提交阶段检查范围
```

Expected: root `package.json` triggers full typecheck under the new gate, but no E2E or containers.

---

### Task 4: Final hook verification

**Files:**

- Verify only; modify only a defect introduced by Tasks 1-3.

**Interfaces:**

- Consumes: classifier, commit-check runner, lint-staged config, CI policy.
- Produces: evidence that local gates are scoped and CI remains complete.

- [ ] **Step 1: Run all tooling contracts**

```text
node --test scripts/commit-scope.test.mjs scripts/repository-policy.test.mjs scripts/ci-policy.test.mjs scripts/workspace-contract.test.mjs
pnpm lint:scripts
git diff --check
```

- [ ] **Step 2: Exercise staged scope behavior with temporary index-only probes**

Use `git diff --cached --name-only -z` to confirm the implementation sees exactly staged files. Do not create dummy commits or stage unrelated user files. The committed classifier fixtures are the authoritative mapping proof.

- [ ] **Step 3: Verify preserved explicit/full commands without running E2E**

Read `package.json` and `.github/workflows/ci.yml` and confirm these strings remain:

```text
pnpm lint
pnpm typecheck
pnpm test:e2e
pnpm build
```

Do not start containers or run Server/Admin E2E.

- [ ] **Step 4: Inspect branch scope**

```text
git status --short
git log --oneline 8b650e7..HEAD
git diff 8b650e7..HEAD --stat
```

Expected: only files listed in this plan changed; the existing unrelated UniApp engineering changes remain intact for their own plan.
