# Miniapp Project Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将跨端客户端的项目身份从 `uniapp` 完整硬更名为 `miniapp`，同时保留 UniApp 框架技术标识和现有行为。

**Architecture:** 以现有工程契约作为公共验证边界，先让测试期望新路径、包名和命令并确认红灯，再使用 Git 目录移动和精确配置更新完成绿灯。历史规格与调研保持不变，现行开发入口文档同步新项目身份。

**Tech Stack:** pnpm workspace、Turborepo、UniApp、Vue 3、Node test runner、ESLint、Prettier。

## Global Constraints

- 不保留 `apps/uniapp`、`@petcare/uniapp` 或 `dev/build:uniapp:*` 兼容别名。
- 不更改 UniApp、`@dcloudio/uni-*`、`@uni-helper/*`、`uni_modules` 等框架和工具标识。
- 不升级依赖、不迁移业务、不修改生成文件内容。
- 不运行四端构建、E2E、数据库、Redis 或其他服务。
- 历史 `docs/superpowers` 和 `docs/research` 文件不批量改写。

---

### Task 1: 将工程契约切换到 Miniapp 项目身份

**Files:**

- Modify: `scripts/commit-scope.mjs`
- Modify: `scripts/commit-scope.test.mjs`
- Modify: `scripts/workspace-contract.test.mjs`
- Modify: `scripts/repository-policy.test.mjs`
- Rename: `scripts/uniapp-engineering-config.test.mjs` to `scripts/miniapp-engineering-config.test.mjs`
- Rename: `scripts/uniapp-minimal-shell.test.mjs` to `scripts/miniapp-minimal-shell.test.mjs`

**Interfaces:**

- Consumes: Git 暂存路径、根 `package.json`、客户端 `package.json` 和 ESLint 配置。
- Produces: `apps/miniapp` 到 `@petcare/miniapp` 的受影响 workspace 分类和新项目身份契约。

- [ ] **Step 1: 更新契约测试的路径、包名和命令期望**

  将公共断言改为 `apps/miniapp`、`@petcare/miniapp`、`dev:miniapp:*` 和 `build:miniapp:*`，测试标题使用 Miniapp；框架解析相关标题继续使用 UniApp。

- [ ] **Step 2: 运行红灯测试**

  Run: `node --test scripts/commit-scope.test.mjs scripts/workspace-contract.test.mjs scripts/repository-policy.test.mjs scripts/miniapp-engineering-config.test.mjs scripts/miniapp-minimal-shell.test.mjs`

  Expected: FAIL，因为实现目录、包名和根脚本仍使用 `uniapp`。

- [ ] **Step 3: 更新提交范围实现**

  将 `scripts/commit-scope.mjs` 的直接 workspace 映射和全量 selector 改为 `apps/miniapp/` 与 `@petcare/miniapp`。

### Task 2: 硬更名客户端目录和 workspace 配置

**Files:**

- Rename: `apps/uniapp/` to `apps/miniapp/`
- Modify: `apps/miniapp/package.json`
- Modify: `apps/miniapp/eslint.config.mjs`
- Modify: `package.json`
- Modify: `.prettierignore`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 的新工程契约。
- Produces: `apps/miniapp` workspace、`@petcare/miniapp` filter 和 `*:miniapp:*` 根命令。

- [ ] **Step 1: 使用 Git 移动目录和工程测试文件**

  Run: `git mv apps/uniapp apps/miniapp`

- [ ] **Step 2: 精确更新活动配置**

  更新根脚本、lint-staged、客户端包名、ESLint ignore、Prettier ignore 和测试文件名引用。根 `.gitignore` 已使用通用 `unpackage/` 与签名扩展规则，无需按目录更改。UniApp 框架注释与依赖名保持不变。

- [ ] **Step 3: 更新 lockfile importer**

  Run: `$env:CI='true'; pnpm install --frozen-lockfile=false`

  Expected: `pnpm-lock.yaml` 仅发生 workspace importer 更名所需变化，不升级依赖。

- [ ] **Step 4: 运行绿灯工程契约**

  Run: `node --test scripts/commit-scope.test.mjs scripts/workspace-contract.test.mjs scripts/repository-policy.test.mjs scripts/miniapp-engineering-config.test.mjs scripts/miniapp-minimal-shell.test.mjs`

  Expected: PASS。

### Task 3: 更新现行文档并完成验收

**Files:**

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/03-technical-architecture/01-tech-stack.md`
- Modify: `docs/03-technical-architecture/02-monorepo-structure.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/09-development-guidelines/01-development-guidelines.md`
- Modify: `docs/09-development-guidelines/02-development-standards.md`
- Modify: `docs/09-development-guidelines/04-styling-standards.md`
- Modify: `docs/09-development-guidelines/05-frontend-structure-and-api-contracts.md`
- Modify: `docs/01-requirements/04-prototype-specification.md`
- Modify: `docs/environment-variables.md`
- Modify: `docs/10-brand-system/PetCare-Brand-Book-v1.0.md`
- Modify: `apps/miniapp/README.md`

**Interfaces:**

- Consumes: 新目录、包名和根命令。
- Produces: 现行文档中一致的“Miniapp 项目，技术框架为 UniApp”表述。

- [ ] **Step 1: 更新现行文档路径和命令**

  只改项目身份引用；框架名称继续写作 UniApp。历史规格、计划和调研文件不修改。

- [ ] **Step 2: 扫描活动配置残留**

  Run: `rg -n 'apps/uniapp|@petcare/uniapp|(?:dev|build):uniapp:' package.json .gitignore .prettierignore scripts apps README.md AGENTS.md docs --glob '!docs/superpowers/**' --glob '!docs/research/**'`

  Expected: no matches。

- [ ] **Step 3: 运行客户端验证**

  Run: `pnpm --filter @petcare/miniapp lint`

  Run: `pnpm --filter @petcare/miniapp typecheck`

  Run: `pnpm --filter @petcare/miniapp test`

  Expected: all PASS。

- [ ] **Step 4: 运行格式和契约验证**

  Run: `prettier --check package.json pnpm-lock.yaml .gitignore .prettierignore scripts apps/miniapp README.md AGENTS.md docs/03-technical-architecture docs/08-deployment docs/09-development-guidelines docs/01-requirements/04-prototype-specification.md docs/environment-variables.md docs/10-brand-system/PetCare-Brand-Book-v1.0.md`

  Run: `node --test scripts/commit-scope.test.mjs scripts/workspace-contract.test.mjs scripts/repository-policy.test.mjs scripts/miniapp-engineering-config.test.mjs scripts/miniapp-minimal-shell.test.mjs`

  Run: `git diff --check`

  Expected: all PASS。

- [ ] **Step 5: 提交更名实现**

  Run: `git add -- . ':!docs/10-brand-system/generated' ':!docs/superpowers/plans/2026-08-11-petcare-community-featured-refinement.md' ':!docs/superpowers/plans/2026-08-11-petcare-community-featured.md'`

  Run: `git commit -m "refactor: 将 UniApp 项目更名为 Miniapp"`

  Expected: 正常 hooks 通过，提交不包含四端构建或 E2E。
