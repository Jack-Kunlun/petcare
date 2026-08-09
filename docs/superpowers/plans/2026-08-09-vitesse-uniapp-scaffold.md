# Vitesse Uni App Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `apps/uniapp` workspace project from the official Vitesse-based `wot-starter-v2` template without migrating any existing Taro business code.

**Architecture:** Keep `apps/miniapp` unchanged and introduce `@petcare/uniapp` as a separate Vue 3 + uni-app application. Preserve the official Wot UI v2 and UnoCSS starter source/configuration, but remove nested-repository governance and adapt lifecycle scripts to PetCare's root pnpm/Turborepo/ESLint/Husky contracts.

**Tech Stack:** uni-app, Vue 3, Vite, TypeScript, Wot UI v2 (`@wot-ui/ui`), UnoCSS, pnpm 11, Turborepo, Vitest.

## Global Constraints

- Use the official `wot-starter-v2` template distributed by `pnpm create uni@latest`.
- Create the app at `apps/uniapp` with package name `@petcare/uniapp`.
- Do not migrate, copy, rename, or delete any code from `apps/miniapp`.
- Keep Wot UI v2 and UnoCSS enabled; do not replace them with another component or atomic-CSS system.
- Root versions remain Node `>=22.18.0 <23`, pnpm `>=11.0.0 <12`, and package manager `pnpm@11.15.1`.
- The new app must be governed by the root lockfile, Husky, lint-staged, Prettier, workspace lifecycle contract, and commit-time typecheck list.
- Remove nested template lock/workspace/Git-hook/release governance; do not create a nested Git repository.
- The default starter page is allowed; no PetCare business feature or API migration is in scope.
- Four targets are H5, WeChat Mini Program, Android App, and iOS App. CLI App builds prove compilation/offline resources only; APK/IPA packaging remains a user-run HBuilderX/native signing step.

---

### Task 1: Scaffold and integrate the UniApp workspace

**Files:**
- Create: `apps/uniapp/**` from official `wot-starter-v2`, retaining its runtime source, Wot UI v2 integration, UnoCSS configuration, Vite/uni-app platform configuration, and minimal starter page.
- Create or replace: `apps/uniapp/README.md` with PetCare-specific install/run/build/output/HBuilderX instructions for the four targets.
- Modify: `apps/uniapp/package.json` to use `@petcare/uniapp`, root-compatible engines, and lifecycle scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:coverage`, `clean` plus four-target scripts.
- Modify: `package.json` to add explicit UniApp dev/build aliases and UniApp lint-staged handling without changing existing Miniapp aliases.
- Modify: `scripts/workspace-contract.test.mjs` to include `apps/uniapp/package.json` and assert the new root/app contracts.
- Modify: `scripts/commit-check.mjs` to include `apps/uniapp/tsconfig.json` in commit-time typechecking.
- Modify only if required by the generated template: `.gitignore`, `.prettierignore`, `turbo.json`.
- Do not modify: `apps/miniapp/**`.

**Interfaces:**
- Consumes: root `apps/*` pnpm workspace inclusion, Turbo lifecycle names, root `scripts/clean.mjs`, and root lint-staged/Husky governance.
- Produces: workspace package `@petcare/uniapp`; scripts `dev:h5`, `dev:mp-weixin`, `dev:app-android`, `dev:app-ios`, `build:h5`, `build:mp-weixin`, `build:app-android`, `build:app-ios`, `typecheck`, `lint`, `test`, `test:coverage`, `clean`.

- [ ] **Step 1: Record the official template source and verify CLI options**

Run `pnpm create uni@latest --help` and confirm a non-interactive `wot-starter-v2` selection. Record the CLI/package version or generated template provenance in `apps/uniapp/README.md`; do not claim a version that the command did not report.

- [ ] **Step 2: Add failing workspace contract assertions**

Update `scripts/workspace-contract.test.mjs` so `workspaceManifests` contains `apps/uniapp/package.json`, the root exposes explicit UniApp aliases, the app package is named `@petcare/uniapp`, and the required lifecycle/target scripts exist. Run:

```powershell
node --test scripts/workspace-contract.test.mjs
```

Expected before scaffolding: failure because `apps/uniapp/package.json` does not exist.

- [ ] **Step 3: Generate the official starter into `apps/uniapp`**

Use the confirmed non-interactive create-uni command. Do not hand-author a substitute template. If the CLI generates a nested `.git`, lockfile, workspace file, Husky hooks, CI, release configuration, demo documentation site, or other repository-root governance, remove those generated artifacts only from `apps/uniapp`.

- [ ] **Step 4: Adapt package and source configuration to PetCare**

Set package name to `@petcare/uniapp`; remove nested `packageManager`, `prepare`, commit/release scripts, and nested lint-staged configuration. Match root Node/pnpm engine ranges. Keep the official Vue/uni-app/Wot UI/UnoCSS runtime dependencies and platform configuration. Replace any template App ID with a clearly unconfigured development value and document that real IDs/certificates are user-supplied; do not invent credentials.

Required lifecycle behavior:

```json
{
  "dev": "pnpm dev:h5",
  "build": "pnpm build:h5",
  "typecheck": "vue-tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run --passWithNoTests",
  "test:coverage": "vitest run --coverage --passWithNoTests",
  "clean": "node ../../scripts/clean.mjs dist coverage .turbo"
}
```

Retain the official target commands using `uni`, including `-p mp-weixin`, `-p app-android`, and `-p app-ios`.

- [ ] **Step 5: Integrate root scripts and commit governance**

Add root aliases that filter `@petcare/uniapp` for the four `dev:*` and four `build:*` target scripts. Add lint-staged rules for `apps/uniapp/**/*.{js,mjs,ts,vue}` using the app's Prettier and ESLint and for its stylesheet/config formats using Prettier. Add `apps/uniapp/tsconfig.json` to `scripts/commit-check.mjs`. Do not alter existing `@petcare/miniapp` aliases or checks.

- [ ] **Step 6: Document four-target validation honestly**

In `apps/uniapp/README.md`, document commands, output directories, and manual steps for H5, WeChat DevTools, Android/HBuilderX, and iOS/HBuilderX/Xcode. Explicitly distinguish CLI compilation/offline resources from final APK/IPA signing and installation. Include placeholders only for user-owned App IDs, signing certificates, and store credentials; do not add secrets.

- [ ] **Step 7: Verify the integrated workspace**

Run from the isolated worktree root:

```powershell
node --test scripts/workspace-contract.test.mjs scripts/repository-policy.test.mjs scripts/style-policy.test.mjs
pnpm --filter @petcare/uniapp lint
pnpm --filter @petcare/uniapp typecheck
pnpm --filter @petcare/uniapp test
pnpm --filter @petcare/uniapp build:h5
pnpm --filter @petcare/uniapp build:mp-weixin
pnpm --filter @petcare/uniapp build:app-android
pnpm --filter @petcare/uniapp build:app-ios
git diff --check
```

Expected: commands exit `0`; build outputs exist under the template's configured `dist` directories. If Android/iOS compilation is unavailable without HBuilderX/native tooling, report the exact limitation rather than treating an unrun build as passing.

- [ ] **Step 8: Self-review and commit**

Confirm no diff under `apps/miniapp/**`, no nested lock/workspace/Git hooks, no secrets or real App IDs, and no duplicated PetCare business code. Commit only this task with a Conventional Commit message such as:

```powershell
git add apps/uniapp package.json pnpm-lock.yaml scripts/workspace-contract.test.mjs scripts/commit-check.mjs docs/superpowers/plans/2026-08-09-vitesse-uniapp-scaffold.md
git commit -m "feat(uniapp): 搭建多端客户端基础项目"
```
