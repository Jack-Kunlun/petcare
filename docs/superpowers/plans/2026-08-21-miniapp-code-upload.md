# Miniapp Secure Code Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing mutable, checkout-local Miniapp upload path with an exact-SHA, CI-gated, pinned and temporary-key GitHub Actions workflow.

**Architecture:** A resolve job checks out the requested ref and verifies a successful `ci.yml` run for the resulting full SHA. A protected upload job installs the locked workspace, builds `mp-weixin` with the public AppID, decodes the upload key into runner temp, invokes the pinned official CLI, and always removes the exact temp directory.

**Tech Stack:** GitHub Actions, pnpm, UniApp, `miniprogram-ci@2.1.31`, Node.js built-in policy tests.

**Spec:** `docs/superpowers/specs/2026-08-21-miniapp-code-upload-design.md`

## Global Constraints

- Upload code only; do not automate WeChat review submission or end-user release.
- Never read, print, commit, artifact-upload, or place the WeChat private key in the checkout.
- Use only `MP_UPLOAD_PRIVATE_KEY_B64`; do not add an AppSecret.
- The upload must target one full SHA with a successful exact-SHA `ci.yml` run.
- No `npx`, `latest`, third-party upload Action, or new wrapper module.
- Local execution must not call the real WeChat upload endpoint.

---

### Task 1: Protect and pin the manual Miniapp upload

**Files:**

- Modify: `.github/workflows/miniapp-release.yml`
- Modify: `apps/miniapp/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/ci-policy.test.mjs`

**Interfaces:**

- Consumes: `ci.yml` exact-SHA success, `apps/miniapp` build script, public AppID `wx3bdad4ab652f0d1d`, Environment secret `MP_UPLOAD_PRIVATE_KEY_B64`.
- Produces: one protected manual upload that creates a WeChat development/experience version for the selected commit.

- [ ] **Step 1: Add the failing public policy**

Extend `scripts/ci-policy.test.mjs` to read the workflow and Miniapp package manifest, then require:

```javascript
assert.equal(miniappPackage.devDependencies["miniprogram-ci"], "2.1.31");
assert.match(workflow, /ref: \$\{\{ inputs\.ref \}\}/);
assert.match(workflow, /git rev-parse HEAD/);
assert.match(workflow, /actions\/workflows\/ci\.yml\/runs\?head_sha=\$sha&status=completed/);
assert.match(workflow, /environment: production/);
assert.match(workflow, /group: petcare-miniapp-production/);
assert.match(workflow, /MP_UPLOAD_PRIVATE_KEY_B64: \$\{\{ secrets\.MP_UPLOAD_PRIVATE_KEY_B64 \}\}/);
assert.match(
  workflow,
  /petcare-miniapp-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/,
);
assert.match(workflow, /pnpm --dir apps\/miniapp exec miniprogram-ci upload/);
assert.match(workflow, /--use-project-config true/);
assert.match(workflow, /if: always\(\)/);
assert.doesNotMatch(workflow, /npx|@latest|MP_UPLOAD_PRIVATE_KEY(?!_B64)|WECHAT_APP_SECRET/);
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test scripts/ci-policy.test.mjs
```

Expected: FAIL because the current workflow has no exact-SHA gate, protected Environment, pinned dependency, or isolated Base64 key path.

- [ ] **Step 3: Pin the official CLI**

Run from the repository root:

```bash
pnpm --filter @petcare/miniapp add --save-dev --save-exact miniprogram-ci@2.1.31
```

Keep only the expected `apps/miniapp/package.json` and `pnpm-lock.yaml` changes. Do not approve unrelated dependency build scripts.

- [ ] **Step 4: Replace the workflow with the minimum protected transaction**

Use `workflow_dispatch` inputs `ref`, `version`, and `desc`; permissions `contents: read` and `actions: read`; and:

```yaml
concurrency:
  group: petcare-miniapp-production
  cancel-in-progress: false
```

The `resolve` job checks out `${{ inputs.ref }}`, calculates `sha="$(git rev-parse HEAD)"`, validates `^[0-9a-f]{40}$`, and queries:

```bash
gh api \
  "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$sha&status=completed&per_page=50" \
  --jq '[.workflow_runs[] | select(.conclusion == "success")] | length'
```

The upload job uses `needs: resolve`, `environment: production`, and checks out `${{ needs.resolve.outputs.sha }}`. Its stable values are:

```yaml
env:
  WECHAT_APP_ID: wx3bdad4ab652f0d1d
  MINIAPP_TMP: ${{ runner.temp }}/petcare-miniapp-${{ github.run_id }}-${{ github.run_attempt }}
  MP_VERSION: ${{ inputs.version }}
  MP_DESC: ${{ inputs.desc }}
```

Validate `MP_VERSION` with `^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$`; require a non-empty `MP_DESC` without CR/LF. Build and verify:

```bash
pnpm build:miniapp:mp-weixin
test -s apps/miniapp/dist/build/mp-weixin/app.json
test -s apps/miniapp/dist/build/mp-weixin/project.config.json
```

Create the key without exposing it:

```bash
# This step alone receives:
# MP_UPLOAD_PRIVATE_KEY_B64: ${{ secrets.MP_UPLOAD_PRIVATE_KEY_B64 }}
umask 077
install -d -m 700 "$MINIAPP_TMP"
printf '%s' "$MP_UPLOAD_PRIVATE_KEY_B64" | base64 --decode > "$MINIAPP_TMP/private.key"
chmod 600 "$MINIAPP_TMP/private.key"
test -s "$MINIAPP_TMP/private.key"
```

Upload using only the locked dependency:

```bash
pnpm --dir apps/miniapp exec miniprogram-ci upload \
  --pp dist/build/mp-weixin \
  --pkp "$MINIAPP_TMP/private.key" \
  --appid "$WECHAT_APP_ID" \
  --uv "$MP_VERSION" \
  --desc "$MP_DESC" \
  -r 1 \
  --use-project-config true
```

Add an `if: always()` final step that runs only `rm -rf -- "$MINIAPP_TMP"`.

- [ ] **Step 5: Run GREEN and scoped verification**

Run:

```bash
node --test scripts/ci-policy.test.mjs scripts/deploy-policy.test.mjs
$env:WECHAT_APP_ID='wx3bdad4ab652f0d1d'; pnpm build:miniapp:mp-weixin
node node_modules/prettier/bin/prettier.cjs --check .github/workflows/miniapp-release.yml apps/miniapp/package.json scripts/ci-policy.test.mjs
git diff --check
```

Expected: policy and compile pass. The actual upload and actionlint remain GitHub/WeChat gates.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/miniapp-release.yml apps/miniapp/package.json pnpm-lock.yaml scripts/ci-policy.test.mjs docs/superpowers/specs/2026-08-21-miniapp-code-upload-design.md docs/superpowers/plans/2026-08-21-miniapp-code-upload.md
git commit -m "ci(miniapp): 保护微信小程序手动上传"
```
