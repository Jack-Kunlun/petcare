# Node 24 and GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 PetCare 的开发、CI 和容器运行时统一迁移到 Node 24.19，并将 checkout/setup-node 升级到 v7。

**Architecture:** 先用仓库契约测试锁定 Node 与 Actions 的目标版本，再修改唯一的运行时声明面，最后更新现行文档并执行全量验证。该 PR 不包含业务依赖升级，也不修改 `apps/miniapp`。

**Tech Stack:** Node.js 24.19、pnpm 11.15.1、GitHub Actions、Docker Alpine、Node test runner。

## Global Constraints

- `apps/miniapp` 不得产生任何文件差异。
- `.nvmrc` 与 CI 固定为 `24.19.0`。
- 根目录和 UniApp 的 `engines.node` 必须为 `>=24.12.0 <25`。
- Admin 与 Server Docker 阶段必须统一使用 `node:24.19-alpine`。
- `actions/checkout` 与 `actions/setup-node` 必须全部为 `v7`。
- pnpm 继续固定为 `11.15.1`；本 PR 不升级 pnpm。
- 不改写历史计划或历史规格中的 Node 22 记录。
- 每个提交前运行 `git diff --check`，不得绕过失败检查。

---

### Task 1: 用契约测试锁定 Node 24 与 Actions v7

**Files:**

- Modify: `scripts/workspace-contract.test.mjs:62-79`
- Modify: `scripts/ci-policy.test.mjs:7-20`

**Interfaces:**

- Consumes: 根 `package.json`、`apps/uniapp/package.json` 和 `.github/workflows/ci.yml`。
- Produces: 对 Node engine、CI Node 版本和 Actions 主版本的精确仓库契约。

- [ ] **Step 1: 更新 workspace engine 断言**

将根 engine 断言改为 Node 24，并为 UniApp 增加相同断言：

```js
assert.equal(manifest.engines.node, ">=24.12.0 <25");
assert.equal(manifest.engines.pnpm, ">=11.0.0 <12");

const uniappManifest = await readJson("apps/uniapp/package.json");
assert.equal(uniappManifest.engines.node, manifest.engines.node);
assert.equal(uniappManifest.engines.pnpm, manifest.engines.pnpm);
```

- [ ] **Step 2: 更新 CI 版本断言**

在 `scripts/ci-policy.test.mjs` 的首个测试中使用以下断言：

```js
assert.match(workflow, /^  NODE_VERSION: "24\.19\.0"$/m);
assert.match(workflow, /actions\/checkout@v7/);
assert.match(workflow, /actions\/setup-node@v7/);
assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v6/);
```

保留 `pnpm/action-setup@v6` 与 `actions/upload-artifact@v7` 的现有断言。

- [ ] **Step 3: 运行目标测试并确认红灯原因正确**

Run:

```powershell
node --test scripts/workspace-contract.test.mjs scripts/ci-policy.test.mjs
```

Expected: FAIL；失败信息分别显示当前 `>=22.18.0 <23`、`NODE_VERSION: "22"`、checkout/setup-node v6 与新契约不一致。

- [ ] **Step 4: 检查测试差异**

Run:

```powershell
git diff --check
git diff -- scripts/workspace-contract.test.mjs scripts/ci-policy.test.mjs
```

Expected: 无 whitespace error，差异只包含上述契约变化。

### Task 2: 统一运行时、CI 和 Docker 声明

**Files:**

- Modify: `.nvmrc:1`
- Modify: `package.json:62-65`
- Modify: `apps/uniapp/package.json:7-10`
- Modify: `.github/workflows/ci.yml:11-31,45-73,116-130`
- Modify: `Dockerfile.admin:2`
- Modify: `Dockerfile.server:2,29`
- Test: `scripts/workspace-contract.test.mjs`
- Test: `scripts/ci-policy.test.mjs`

**Interfaces:**

- Consumes: Task 1 的精确版本契约。
- Produces: 本地、CI 与容器一致的 Node 24.19 运行时声明。

- [ ] **Step 1: 修改 Node 声明**

应用以下精确值：

```text
.nvmrc: 24.19.0
package.json engines.node: >=24.12.0 <25
apps/uniapp/package.json engines.node: >=24.12.0 <25
```

- [ ] **Step 2: 修改 CI 与 Actions**

在 `.github/workflows/ci.yml` 中修改：

```yaml
env:
  NODE_VERSION: "24.19.0"
  PNPM_VERSION: "11.15.1"
```

将所有 `actions/checkout@v6` 替换为 `actions/checkout@v7`，所有 `actions/setup-node@v6` 替换为 `actions/setup-node@v7`；不改动其他 Action。

- [ ] **Step 3: 修改 Docker 镜像**

使用以下镜像行：

```dockerfile
FROM node:24.19-alpine AS admin-builder
FROM node:24.19-alpine AS server-builder
FROM node:24.19-alpine AS server-runner
```

- [ ] **Step 4: 运行目标契约测试并确认绿灯**

Run:

```powershell
node --test scripts/workspace-contract.test.mjs scripts/ci-policy.test.mjs
```

Expected: PASS，0 failures。

- [ ] **Step 5: 验证 Node 24 安装契约**

Run:

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
```

Expected: Node `v24.19.0`、pnpm `11.15.1`，安装成功且不再出现 root/UniApp engine warning；Argon2、Prisma、Taro 与 UniApp postinstall 成功。

- [ ] **Step 6: 提交运行时与契约变更**

```powershell
git add .nvmrc package.json apps/uniapp/package.json .github/workflows/ci.yml Dockerfile.admin Dockerfile.server scripts/workspace-contract.test.mjs scripts/ci-policy.test.mjs
git commit -m "chore: 迁移至 Node 24 LTS"
```

### Task 3: 更新现行 Node 文档

**Files:**

- Modify: `README.md:27-35`
- Modify: `docs/08-deployment/deployment.md:17-24`
- Modify: `AGENTS.md:52-58`

**Interfaces:**

- Consumes: Task 2 的 Node `24.19.0` 和 engine `>=24.12.0 <25`。
- Produces: 与可执行配置一致的当前开发和部署说明。

- [ ] **Step 1: 更新 README 前置要求**

将 Node 条目改为：

```markdown
- Node.js 24.19.x（使用 `.nvmrc` 锁定，最低支持 24.12.0）
```

- [ ] **Step 2: 更新部署指南前置要求**

将 Node 条目改为：

```markdown
- Node.js 24.19.x，最低支持 24.12.0
```

- [ ] **Step 3: 更新 AGENTS.md 当前版本说明**

将 Node 版本小节改为：

```markdown
- **锁定版本**: 24.19.0（见 `.nvmrc`）
- **要求**: >= 24.12.0 且 < 25
```

- [ ] **Step 4: 检索当前文档中的陈旧声明**

Run:

```powershell
rg -n "Node(\.js)? 22|锁定版本.*22|node:22|>=22\.18\.0 <23" README.md AGENTS.md docs/08-deployment .nvmrc package.json apps/uniapp/package.json Dockerfile.admin Dockerfile.server .github/workflows/ci.yml scripts
```

Expected: 无匹配。不要扫描或修改 `docs/superpowers/plans/2026-07-*` 与 `docs/superpowers/specs/2026-07-*` 的历史记录。

- [ ] **Step 5: 格式检查并提交文档**

Run:

```powershell
pnpm exec prettier --check README.md docs/08-deployment/deployment.md AGENTS.md
git diff --check
```

Expected: PASS。

```powershell
git add README.md docs/08-deployment/deployment.md AGENTS.md
git commit -m "docs: 更新 Node 24 环境要求"
```

### Task 4: PR 1 全量验证与发布

**Files:**

- Verify only: repository-wide

**Interfaces:**

- Consumes: Tasks 1-3 的完整 Node/Actions 迁移。
- Produces: 可合并的 `codex/node24-actions` PR，替代 #1、#2、#14。

- [ ] **Step 1: 验证 Miniapp 零差异**

Run:

```powershell
git diff --exit-code origin/master...HEAD -- apps/miniapp
```

Expected: exit code 0，无输出。

- [ ] **Step 2: 运行本地质量门禁**

Run each command independently:

```powershell
pnpm test:tooling
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
git diff --check origin/master...HEAD
```

Expected: 所有命令通过。Windows 上若“受控关闭会清除真实子孙进程及其监听端口”单测失败，单独连续运行三次并记录结果；该用例仍须在 GitHub Ubuntu runner 通过，不得在本 PR 中删除或跳过测试。

- [ ] **Step 3: 验证 Docker 构建**

Run:

```powershell
docker compose build server admin
```

Expected: 两个镜像均使用 Node 24.19 Alpine 完成依赖安装和构建。

- [ ] **Step 4: 推送并创建 PR**

Run:

```powershell
git push -u origin codex/node24-actions
gh pr create --base master --head codex/node24-actions --title "chore: 迁移至 Node 24 LTS" --body "## 摘要`n- 统一迁移到 Node 24.19 LTS`n- 升级 checkout/setup-node 到 v7`n- 保持 apps/miniapp 零差异`n`n## 替代 PR`n替代 #1、#2、#14；Node 25 PR 不合并。`n`n## 验证`n已运行规格中的本地与 Docker 门禁。"
```

PR 正文必须列出：Node 版本矩阵、Actions v7、验证结果、Miniapp 零差异，以及“替代 #1、#2、#14；不合并 Node 25 PR”。

- [ ] **Step 5: 等待 GitHub 检查并合并**

Run:

```powershell
$node24Pr = gh pr view codex/node24-actions --json number --jq .number
gh pr checks $node24Pr --watch
gh pr merge $node24Pr --squash --delete-branch
```

Expected: 所有 required checks 通过后才执行 squash merge；不得使用 admin bypass。

- [ ] **Step 6: 关闭被替代 PR**

在新 PR 已合并后执行：

```powershell
$node24Pr = gh pr view codex/node24-actions --json number --jq .number
gh pr close 1 --comment "已由 Node 24 维护 PR #$node24Pr 替代并合并。"
gh pr close 2 --comment "已由 Node 24 维护 PR #$node24Pr 替代并合并。"
gh pr close 14 --comment "Node 25 已停止支持；已由 Node 24 LTS 维护 PR #$node24Pr 替代并合并。"
```

Expected: #1、#2、#14 closed；#6、#7 不变。
