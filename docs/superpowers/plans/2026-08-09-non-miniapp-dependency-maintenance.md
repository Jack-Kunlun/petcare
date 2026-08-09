# Non-Miniapp Dependency Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Node 24 PR 合并后，同步升级非 Miniapp 的目标依赖族，修复仍可复现的 CI 故障，并替代其余相关 Dependabot PR。

**Architecture:** 从包含 Node 24 的最新 `origin/master` 创建第二个隔离分支。先增加依赖族一致性契约，再按 tooling、Admin、Server 顺序更新 manifest 与共享 lockfile，最后用最小复现修复 Jest/UniApp CI 问题并执行全量验证。

**Tech Stack:** pnpm 11.15.1、ESLint 9、TypeScript ESLint 8、React 19、Prisma 7、Turbo 2、Jest 30、UniApp/ECharts。

## Global Constraints

- `apps/miniapp` 不得产生任何文件差异；PR #6、#7 不评论、不关闭、不合并。
- ESLint 保持 9.x，目标 `9.39.5`；不升级 ESLint 10。
- TypeScript ESLint 已声明的同族包统一为 `8.66.0`。
- Admin React/React DOM 统一为 `^19.2.8`。
- Prisma CLI、Client 和 adapter-pg 统一为 `7.9.1`。
- Turbo 使用 `^2.10.9`。
- 锁文件由 pnpm 11.15.1 生成，不接受全量引号/空行重写。
- 只修复在最新主线仍能复现的 CI 问题，不重复移植已经合并的其他任务修复。
- 每个真实缺陷先复现后修复；不删除、不跳过失败测试。

---

### Task 1: 从已合并的 Node 24 主线建立 PR 2 工作区

**Files:**

- Create worktree: `.worktrees/codex-non-miniapp-deps`
- Branch: `codex/non-miniapp-dependency-maintenance`

**Interfaces:**

- Consumes: 已合并 PR 1 的最新 `origin/master`。
- Produces: 不包含本地主分支额外提交的干净依赖维护分支。

- [ ] **Step 1: 刷新并确认 PR 1 已进入远端主线**

Run:

```powershell
git fetch --prune origin
git log -5 --oneline origin/master
```

Expected: 日志包含 Node 24 PR 的 squash commit。

- [ ] **Step 2: 创建隔离工作树**

Run:

```powershell
git worktree add .worktrees/codex-non-miniapp-deps -b codex/non-miniapp-dependency-maintenance origin/master
```

Expected: 新工作树 HEAD 等于 `origin/master`。

- [ ] **Step 3: 安装并记录基线**

Run:

```powershell
pnpm install --frozen-lockfile
pnpm test:tooling
git status --short
```

Expected: 安装成功；工具测试通过或只重现已记录的 Windows 进程清理用例；Git 状态干净。

### Task 2: 增加依赖族一致性契约

**Files:**

- Create: `scripts/dependency-alignment.test.mjs`
- Modify: `package.json: scripts.test:tooling`

**Interfaces:**

- Consumes: root/Admin/Server manifests。
- Produces: 防止 ESLint、TypeScript ESLint、React 和 Prisma 再次被拆成半套升级的契约测试。

- [ ] **Step 1: 创建依赖一致性测试**

创建 `scripts/dependency-alignment.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readManifest(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

test("非 Miniapp 工具链依赖族保持一致", async () => {
  const root = await readManifest("package.json");
  const admin = await readManifest("apps/admin/package.json");
  const server = await readManifest("apps/server/package.json");

  assert.equal(root.devDependencies["@eslint/js"], root.devDependencies.eslint);
  assert.equal(root.devDependencies.eslint, "9.39.5");
  assert.equal(admin.devDependencies.eslint, root.devDependencies.eslint);
  assert.equal(server.devDependencies.eslint, root.devDependencies.eslint);

  const typescriptEslint = root.devDependencies["typescript-eslint"];
  assert.equal(typescriptEslint, "8.66.0");
  for (const manifest of [admin, server]) {
    assert.equal(manifest.devDependencies["@typescript-eslint/eslint-plugin"], typescriptEslint);
    assert.equal(manifest.devDependencies["@typescript-eslint/parser"], typescriptEslint);
  }
  assert.equal(admin.devDependencies["typescript-eslint"], typescriptEslint);
});

test("Admin React 依赖族保持一致", async () => {
  const admin = await readManifest("apps/admin/package.json");

  assert.equal(admin.dependencies.react, admin.dependencies["react-dom"]);
  assert.equal(admin.dependencies.react, "^19.2.8");
  assert.equal(admin.devDependencies["@types/react"], "^19.2.18");
  assert.equal(admin.devDependencies["@types/react-dom"], "^19.2.4");
});

test("Server Prisma 依赖族保持一致", async () => {
  const server = await readManifest("apps/server/package.json");

  assert.equal(server.dependencies["@prisma/client"], server.dependencies["@prisma/adapter-pg"]);
  assert.equal(server.devDependencies.prisma, server.dependencies["@prisma/client"]);
  assert.equal(server.devDependencies.prisma, "7.9.1");
});
```

- [ ] **Step 2: 将新测试加入 tooling 命令**

在根 `package.json` 的 `test:tooling` 命令中，于 `repository-policy.test.mjs` 后加入：

```text
scripts/dependency-alignment.test.mjs
```

- [ ] **Step 3: 运行测试并确认红灯**

Run:

```powershell
node --test scripts/dependency-alignment.test.mjs
```

Expected: FAIL，分别显示 ESLint 9.39.0、TypeScript ESLint 8.64.0、Admin React 19.2.7 和 Prisma 7.8.0 与目标不一致。

### Task 3: 更新根、Admin 和 Server 工具链依赖

**Files:**

- Modify: `package.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `scripts/dependency-alignment.test.mjs`

**Interfaces:**

- Consumes: Task 2 的依赖族契约。
- Produces: ESLint 9.39.5、TypeScript ESLint 8.66.0、Turbo 2.10.9 的一致工具链。

- [ ] **Step 1: 更新根工具链**

Run:

```powershell
pnpm up -Dw @eslint/js@9.39.5 eslint@9.39.5 turbo@2.10.9 typescript-eslint@8.66.0
```

Expected manifest values:

```json
"@eslint/js": "9.39.5",
"eslint": "9.39.5",
"turbo": "^2.10.9",
"typescript-eslint": "8.66.0"
```

- [ ] **Step 2: 更新 Admin 工具链**

Run:

```powershell
pnpm --filter @petcare/admin up -D eslint@9.39.5 typescript-eslint@8.66.0 @typescript-eslint/eslint-plugin@8.66.0 @typescript-eslint/parser@8.66.0
```

- [ ] **Step 3: 更新 Server 工具链**

Run:

```powershell
pnpm --filter @petcare/server up -D eslint@9.39.5 @typescript-eslint/eslint-plugin@8.66.0 @typescript-eslint/parser@8.66.0
```

- [ ] **Step 4: 运行依赖契约、lint 和类型检查**

Run:

```powershell
node --test --test-name-pattern="非 Miniapp 工具链依赖族保持一致" scripts/dependency-alignment.test.mjs
pnpm lint
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 5: 提交工具链变更**

```powershell
git add package.json apps/admin/package.json apps/server/package.json pnpm-lock.yaml scripts/dependency-alignment.test.mjs
git commit -m "chore: 同步非 Miniapp 工具链依赖"
```

### Task 4: 同步 Admin React 与 Radix 依赖

**Files:**

- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `scripts/dependency-alignment.test.mjs`

**Interfaces:**

- Consumes: Admin 当前 React 19 技术栈。
- Produces: 完整一致的 Admin React 19.2.8 依赖族；不触及 Miniapp React 18。

- [ ] **Step 1: 更新 Admin runtime 依赖**

Run:

```powershell
pnpm --filter @petcare/admin up react@19.2.8 react-dom@19.2.8 @radix-ui/react-dialog@1.1.23
pnpm --filter @petcare/admin up -D @types/react@19.2.18 @types/react-dom@19.2.4
```

Expected manifest values: `react`/`react-dom` 为 `^19.2.8`，Radix 为 `^1.1.23`，类型包分别为 `^19.2.18`、`^19.2.4`。

- [ ] **Step 2: 验证 Admin**

Run:

```powershell
node --test --test-name-pattern="Admin React 依赖族保持一致" scripts/dependency-alignment.test.mjs
pnpm --filter @petcare/admin lint
pnpm --filter @petcare/admin typecheck
pnpm --filter @petcare/admin test
pnpm --filter @petcare/admin build
```

Expected: PASS。

- [ ] **Step 3: 提交 Admin 依赖变更**

```powershell
git add apps/admin/package.json pnpm-lock.yaml
git commit -m "chore(admin): 同步 React 与 Radix 依赖"
```

### Task 5: 同步 Server Prisma 依赖族

**Files:**

- Modify: `apps/server/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Server Prisma 7 配置和现有 schema。
- Produces: Prisma CLI、Client 和 PostgreSQL adapter 统一为 7.9.1。

- [ ] **Step 1: 更新 Prisma 三件套**

Run:

```powershell
pnpm --filter @petcare/server up @prisma/adapter-pg@7.9.1 @prisma/client@7.9.1
pnpm --filter @petcare/server up -D prisma@7.9.1
```

Expected: 三个 manifest specifier 都为 `7.9.1`。

- [ ] **Step 2: 验证 Prisma 与 Server**

Run:

```powershell
pnpm --filter @petcare/server exec prisma validate
pnpm --filter @petcare/server prisma:generate
node --test --test-name-pattern="Server Prisma 依赖族保持一致" scripts/dependency-alignment.test.mjs
pnpm --filter @petcare/server lint
pnpm --filter @petcare/server typecheck
pnpm --filter @petcare/server test
pnpm --filter @petcare/server build
```

Expected: Prisma validate/generate 和 Server 门禁全部通过。

- [ ] **Step 3: 提交 Prisma 变更**

```powershell
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore(server): 同步 Prisma 依赖"
```

### Task 6: 修复仍可复现的 Jest 与 UniApp CI 故障

**Files:**

- Modify: `apps/server/package.json`
- Modify: `apps/uniapp/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: 最新主线的 Jest 30.4.2、jest-environment-node 解析和 ECharts 6.1/ZRender 6.1 解析。
- Produces: Server 显式测试环境和 UniApp 显式 ZRender runtime 依赖。

- [ ] **Step 1: 复现 Server Jest 错误并打印实际版本**

Run:

```powershell
pnpm --filter @petcare/server test -- --runTestsByPath src/config/config.service.spec.ts
pnpm --filter @petcare/server exec node -e "for (const p of ['jest','jest-runtime','jest-mock','jest-environment-node']) console.log(p, require(p + '/package.json').version)"
```

Expected before fix: 测试出现 `clearMocksOnScope is not a function`，或版本输出显示 Server 未显式解析 `jest-environment-node@30.4.1`。若最新主线测试已通过且 manifest 已含该依赖，则不重复修改 Server。

- [ ] **Step 2: 显式安装 Server Jest environment**

仅在 Step 1 仍失败且 manifest 未包含依赖时运行：

```powershell
pnpm --filter @petcare/server add -D jest-environment-node@30.4.1
```

Expected: `apps/server/package.json` 增加 `"jest-environment-node": "^30.4.1"`，目标测试通过。

- [ ] **Step 3: 复现 UniApp ECharts/ZRender 解析错误**

Run:

```powershell
pnpm --filter @petcare/uniapp build:h5
```

Expected before fix: 若最新主线仍缺少直接依赖，Rollup 报无法解析 `zrender/lib/core/util.js`。若构建已通过且 manifest 已含 `zrender: 6.1.0`，不重复修改。

- [ ] **Step 4: 显式安装 UniApp ZRender runtime**

仅在 Step 3 重现且 manifest 未包含依赖时运行：

```powershell
pnpm --filter @petcare/uniapp add zrender@6.1.0
```

Expected: `apps/uniapp/package.json` 增加 `"zrender": "6.1.0"`，`build:h5` 通过。

- [ ] **Step 5: 提交实际需要的 CI 修复**

Run:

```powershell
pnpm exec prettier --check apps/server/package.json apps/uniapp/package.json
git diff --check
git add apps/server/package.json apps/uniapp/package.json pnpm-lock.yaml
git commit -m "fix(ci): 对齐测试环境与 UniApp 图表依赖"
```

如果两个故障在最新主线均已修复且没有文件差异，则跳过提交，但保留验证记录。

### Task 7: 锁文件审计与全量验证

**Files:**

- Verify: `pnpm-lock.yaml`
- Verify: `apps/miniapp/package.json`
- Verify: repository-wide

**Interfaces:**

- Consumes: Tasks 2-6 的全部依赖与 CI 修复。
- Produces: 可合并的非 Miniapp 依赖维护 PR。

- [ ] **Step 1: 审计 Miniapp 与锁文件范围**

Run:

```powershell
git diff --exit-code origin/master...HEAD -- apps/miniapp
git diff --numstat origin/master...HEAD -- pnpm-lock.yaml
git diff origin/master...HEAD -- pnpm-lock.yaml
```

Expected: `apps/miniapp` 无差异；锁文件只包含目标 importer、目标 package snapshot 和不可避免的 peer snapshot 变化，没有全文件引号或空行重写。

- [ ] **Step 2: 从锁文件重新安装**

Run:

```powershell
pnpm install --frozen-lockfile
```

Expected: PASS，lockfile 无后续变化。

- [ ] **Step 3: 运行全量门禁**

Run each independently:

```powershell
pnpm test:tooling
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
docker compose build server admin
git diff --check origin/master...HEAD
```

Expected: 所有命令与 GitHub Actions 全部通过。Windows 独有的进程树测试若本地偶发失败，需连续三次最小复现并确保 Ubuntu CI 通过；不得跳过测试。

### Task 8: 发布 PR 2、合并并整理旧 PR

**Files:**

- GitHub state only

**Interfaces:**

- Consumes: 已通过全部验证的依赖维护分支。
- Produces: 合并后的主线和已关闭的被替代 Dependabot PR。

- [ ] **Step 1: 推送并创建 PR**

Run:

```powershell
git push -u origin codex/non-miniapp-dependency-maintenance
gh pr create --base master --head codex/non-miniapp-dependency-maintenance --title "chore: 更新非 Miniapp 依赖并修复 CI" --body "## 摘要`n- 同步非 Miniapp 工具链、Admin 和 Server 依赖族`n- 修复最新主线仍可复现的 CI 故障`n- 保持 apps/miniapp 零差异并最小化锁文件`n`n## 替代 PR`n替代 #4、#5、#8、#9、#10、#11、#12、#13；#6、#7 不处理。`n`n## 验证`n已运行规格中的全量门禁。"
```

PR 正文列出精确版本、依赖族对齐、CI 根因与修复、锁文件审计、Miniapp 零差异和验证结果。

- [ ] **Step 2: 等待检查并合并**

Run:

```powershell
$dependencyPr = gh pr view codex/non-miniapp-dependency-maintenance --json number --jq .number
gh pr checks $dependencyPr --watch
gh pr merge $dependencyPr --squash --delete-branch
```

Expected: required checks 全绿后 squash merge，不使用 admin bypass。

- [ ] **Step 3: 关闭被替代 PR**

在新 PR 合并后执行：

```powershell
$dependencyPr = gh pr view codex/non-miniapp-dependency-maintenance --json number --jq .number
foreach ($oldPr in 4, 5, 8, 9, 10, 11, 12, 13) {
  gh pr close $oldPr --comment "已由非 Miniapp 依赖维护 PR #$dependencyPr 替代并合并；Miniapp 变更未纳入。"
}
```

Expected: 上述 PR closed；#6、#7 保持原状态。

- [ ] **Step 4: 最终确认开放 PR 列表**

Run:

```powershell
gh pr list --state open --limit 30
```

Expected: 被替代 PR 不再开放；#6、#7 仍保持原状，没有误操作 Miniapp PR。
