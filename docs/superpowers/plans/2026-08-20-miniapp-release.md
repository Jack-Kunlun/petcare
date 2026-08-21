# Miniapp Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manually build the UniApp `mp-weixin` target and upload a validated development/experience version to the WeChat Mini Program platform without exposing the upload private key.

**Architecture:** Pin the official `miniprogram-ci` package inside the Miniapp workspace and call its Node API through one tested script that validates version metadata, output location, and AppID equality. A separate protected GitHub Actions workflow decodes the Base64 key only into runner temporary storage, builds and uploads with the same Environment AppID, and deletes the key unconditionally.

**Tech Stack:** UniApp, Vue 3, Node.js 24.19.0, pnpm 11.15.1, `miniprogram-ci` 2.1.31, GitHub Actions, Node.js built-in tests.

**Spec:** `docs/superpowers/specs/2026-08-20-production-deployment-release-design.md`

## Global Constraints

- This plan is independent of the Docker deployment plans, but execute it after shared `package.json` policy edits to avoid overlapping root-script conflicts.
- The Miniapp AppID is `wx3bdad4ab652f0d1d` and comes from GitHub `wechat-release` Environment variable `MP_APPID`.
- The upload key comes only from GitHub `wechat-release` Environment secret `MP_UPLOAD_PRIVATE_KEY_B64`.
- Inject the same `MP_APPID` as `WECHAT_APP_ID` during build and as the upload project AppID.
- Pin `miniprogram-ci` to exactly `2.1.31`; do not use `latest`, `npx --yes`, or an uncommitted dependency resolution.
- Use a GitHub-hosted runner only while the WeChat upload IP whitelist is disabled.
- Upload creates a development/experience version; review submission and production release remain manual in the WeChat console.
- Never print, commit, archive, cache, or upload the private key as a workflow artifact.
- The legal request domain is `https://admin.petcare-home.com`; `/api` is an application path, not part of the WeChat domain entry.

---

### Task 1: Pin and test the official upload client

**Files:**

- Create: `apps/miniapp/scripts/upload-wechat.mjs`
- Create: `apps/miniapp/scripts/upload-wechat.test.mjs`
- Modify: `apps/miniapp/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/miniapp-minimal-shell.test.mjs`

**Interfaces:**

- Consumes environment values `MP_APPID`, `MP_VERSION`, `MP_DESC`, `MP_PRIVATE_KEY_PATH`, and optional `MP_PROJECT_PATH`.
- Produces: `validateReleaseInput(input)` and the package command `pnpm --filter @petcare/miniapp release:mp-weixin`.

- [ ] **Step 1: Write failing validation tests**

Create `apps/miniapp/scripts/upload-wechat.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseInput } from "./upload-wechat.mjs";

const valid = {
  appid: "wx3bdad4ab652f0d1d",
  version: "2.0.0",
  desc: "GitHub Actions 手动上传",
  privateKeyPath: "/tmp/wechat-upload.key",
  projectPath: "/repo/apps/miniapp/dist/build/mp-weixin",
};

test("accepts an exact AppID and semantic release version", () => {
  assert.deepEqual(validateReleaseInput(valid), valid);
});

test("rejects malformed or missing release inputs", () => {
  assert.throws(() => validateReleaseInput({ ...valid, appid: "" }), /MP_APPID/);
  assert.throws(() => validateReleaseInput({ ...valid, version: "latest" }), /MP_VERSION/);
  assert.throws(() => validateReleaseInput({ ...valid, desc: "" }), /MP_DESC/);
  assert.throws(() => validateReleaseInput({ ...valid, desc: "x".repeat(129) }), /MP_DESC/);
  assert.throws(
    () => validateReleaseInput({ ...valid, privateKeyPath: "" }),
    /MP_PRIVATE_KEY_PATH/,
  );
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test apps/miniapp/scripts/upload-wechat.test.mjs
```

Expected: FAIL because `upload-wechat.mjs` does not exist.

- [ ] **Step 3: Add the pinned dependency and package scripts**

Run:

```bash
pnpm --filter @petcare/miniapp add --save-dev --save-exact miniprogram-ci@2.1.31
```

Add these scripts to `apps/miniapp/package.json`:

```json
"release:mp-weixin": "node scripts/upload-wechat.mjs",
"test:release": "node --test scripts/upload-wechat.test.mjs"
```

Change the existing Miniapp `test` command to:

```json
"test": "pnpm test:release && vitest run --passWithNoTests"
```

Update the exact expected dependency and script lists in `scripts/miniapp-minimal-shell.test.mjs`; adding the official upload client and these two commands is the only allowed shell expansion.

- [ ] **Step 4: Implement strict input validation and AppID comparison**

Create `apps/miniapp/scripts/upload-wechat.mjs` with:

```javascript
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ci from "miniprogram-ci";

export function validateReleaseInput(input) {
  if (!/^wx[0-9a-zA-Z]{16}$/.test(input.appid)) {
    throw new Error("MP_APPID must use the wx plus 16-character format");
  }
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) {
    throw new Error("MP_VERSION must use x.y.z format");
  }
  if (!input.desc || input.desc.length > 128) {
    throw new Error("MP_DESC must contain 1 through 128 characters");
  }
  if (!input.privateKeyPath) {
    throw new Error("MP_PRIVATE_KEY_PATH is required");
  }
  if (!input.projectPath) {
    throw new Error("MP_PROJECT_PATH is required");
  }

  return input;
}

async function main() {
  const projectPath = resolve(
    process.env.MP_PROJECT_PATH || resolve(import.meta.dirname, "../dist/build/mp-weixin"),
  );
  const input = validateReleaseInput({
    appid: process.env.MP_APPID?.trim() || "",
    version: process.env.MP_VERSION?.trim() || "",
    desc: process.env.MP_DESC?.trim() || "",
    privateKeyPath: process.env.MP_PRIVATE_KEY_PATH?.trim() || "",
    projectPath,
  });

  await access(input.privateKeyPath);
  const projectConfig = JSON.parse(
    await readFile(resolve(input.projectPath, "project.config.json"), "utf8"),
  );
  if (projectConfig.appid !== input.appid) {
    throw new Error("Built Miniapp AppID does not match MP_APPID");
  }

  const project = new ci.Project({
    appid: input.appid,
    type: "miniProgram",
    projectPath: input.projectPath,
    privateKeyPath: input.privateKeyPath,
    ignores: ["node_modules/**/*"],
  });

  await ci.upload({
    project,
    version: input.version,
    desc: input.desc,
    setting: { es6: true, es7: true, minify: true, codeProtect: false },
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : "Miniapp upload failed";

    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
```

Do not attach `onProgressUpdate` because SDK progress payloads are not needed and should not widen logs.

- [ ] **Step 5: Run focused Miniapp verification**

Run:

```bash
pnpm --filter @petcare/miniapp test:release
node --test scripts/miniapp-minimal-shell.test.mjs
pnpm --filter @petcare/miniapp lint
pnpm --filter @petcare/miniapp typecheck
```

Expected: all commands exit 0 and the lockfile records `miniprogram-ci` exactly at `2.1.31`.

- [ ] **Step 6: Commit the pinned upload client**

```bash
git add apps/miniapp/scripts/upload-wechat.mjs apps/miniapp/scripts/upload-wechat.test.mjs apps/miniapp/package.json pnpm-lock.yaml scripts/miniapp-minimal-shell.test.mjs
git commit -m "feat(miniapp): 固定微信小程序上传客户端"
```

---

### Task 2: Protect and automate the manual Miniapp upload workflow

**Files:**

- Modify: `.github/workflows/miniapp-release.yml`
- Create: `scripts/miniapp-release-policy.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: GitHub workflow branch/ref selector, inputs `version` and `desc`, `vars.MP_APPID`, and `secrets.MP_UPLOAD_PRIVATE_KEY_B64` from `wechat-release`.
- Produces: one uploaded development/experience build whose build AppID, output AppID, and upload AppID are identical.

- [ ] **Step 1: Write a failing workflow policy test**

Create `scripts/miniapp-release-policy.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("小程序手动上传使用受保护环境、固定依赖与临时 Base64 密钥", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/miniapp-release.yml"), "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: wechat-release/);
  assert.match(workflow, /MP_APPID: \$\{\{ vars\.MP_APPID \}\}/);
  assert.match(workflow, /WECHAT_APP_ID: \$\{\{ vars\.MP_APPID \}\}/);
  assert.match(workflow, /MP_UPLOAD_PRIVATE_KEY_B64/);
  assert.match(workflow, /test -n "\$MP_UPLOAD_PRIVATE_KEY_B64"/);
  assert.match(workflow, /\$RUNNER_TEMP/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /chmod 600/);
  assert.match(workflow, /pnpm --filter @petcare\/miniapp release:mp-weixin/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(
    workflow,
    /miniprogram-ci@latest|npx --yes|MP_UPLOAD_PRIVATE_KEY(?!_B64)|WECHAT_APP_SECRET/,
  );
});
```

Add the test to the root `test:tooling` command.

- [ ] **Step 2: Run the policy and reproduce the insecure current behavior**

Run:

```bash
node --test scripts/miniapp-release-policy.test.mjs
```

Expected: FAIL because the current workflow uses a repository-level plaintext key secret, writes `private.key` in the checkout, invokes `miniprogram-ci@latest`, and has no protected Environment.

- [ ] **Step 3: Define only the user-facing upload metadata inputs**

Keep the GitHub Actions branch/ref selector as the source ref; do not add a duplicate `ref` text input. Define:

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: "上传版本号（x.y.z）"
        required: true
        default: "2.0.0"
      desc:
        description: "微信后台版本备注（1-128 字）"
        required: true
        default: "GitHub Actions 手动上传"
```

Use `permissions: contents: read` and set `environment: wechat-release` on the upload job.

- [ ] **Step 4: Build with the Environment AppID and validate metadata early**

After checkout, installation, and `git rev-parse HEAD`, add:

```yaml
- name: 校验发布参数
  env:
    MP_APPID: ${{ vars.MP_APPID }}
    MP_VERSION: ${{ inputs.version }}
    MP_DESC: ${{ inputs.desc }}
    MP_UPLOAD_PRIVATE_KEY_B64: ${{ secrets.MP_UPLOAD_PRIVATE_KEY_B64 }}
  run: |
    [[ "$MP_APPID" =~ ^wx[0-9A-Za-z]{16}$ ]]
    [[ "$MP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
    [[ -n "$MP_DESC" && ${#MP_DESC} -le 128 ]]
    test -n "$MP_UPLOAD_PRIVATE_KEY_B64"

- name: 构建微信小程序
  env:
    WECHAT_APP_ID: ${{ vars.MP_APPID }}
  run: pnpm --filter @petcare/miniapp build:mp-weixin
```

- [ ] **Step 5: Decode the key only under runner temporary storage and upload**

```yaml
- name: 准备临时上传密钥
  env:
    MP_UPLOAD_PRIVATE_KEY_B64: ${{ secrets.MP_UPLOAD_PRIVATE_KEY_B64 }}
  run: |
    test -n "$MP_UPLOAD_PRIVATE_KEY_B64"
    key_path="$RUNNER_TEMP/wechat-upload-${GITHUB_RUN_ID}.key"
    umask 077
    printf '%s' "$MP_UPLOAD_PRIVATE_KEY_B64" | base64 --decode > "$key_path"
    test -s "$key_path"
    chmod 600 "$key_path"
    echo "MP_PRIVATE_KEY_PATH=$key_path" >> "$GITHUB_ENV"

- name: 上传开发/体验版本
  env:
    MP_APPID: ${{ vars.MP_APPID }}
    MP_VERSION: ${{ inputs.version }}
    MP_DESC: ${{ inputs.desc }}
  run: pnpm --filter @petcare/miniapp release:mp-weixin
```

The uploader reads and compares the generated `project.config.json` before contacting WeChat.

- [ ] **Step 6: Delete the runner key unconditionally**

```yaml
- name: 清理上传密钥
  if: always()
  run: |
    if [[ -n "${MP_PRIVATE_KEY_PATH:-}" ]]; then
      rm -f -- "$MP_PRIVATE_KEY_PATH"
    fi
```

Do not upload the Miniapp output or key as an artifact in this workflow.

- [ ] **Step 7: Run focused workflow policy checks**

Run:

```bash
node --test scripts/miniapp-release-policy.test.mjs scripts/miniapp-minimal-shell.test.mjs
pnpm --filter @petcare/miniapp test:release
git diff --check
```

Expected: all commands exit 0 and the workflow contains neither `latest` nor a non-Base64 private-key secret.

- [ ] **Step 8: Commit the protected upload workflow**

```bash
git add .github/workflows/miniapp-release.yml scripts/miniapp-release-policy.test.mjs package.json
git commit -m "feat(ci): 安全上传微信小程序体验版本"
```

---

### Task 3: Document WeChat console configuration and the manual production boundary

**Files:**

- Modify: `docs/08-deployment/github-actions-deploy.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/environment-variables.md`
- Modify: `SECURITY-CHECKLIST.md`

**Interfaces:**

- Consumes: Tasks 1-2 and the WeChat Mini Program console.
- Produces: an exact setup and release checklist that distinguishes code upload from review and production release.

- [ ] **Step 1: Document the protected GitHub Environment**

Add:

```text
Environment: wechat-release
Variable: MP_APPID=wx3bdad4ab652f0d1d
Secret: MP_UPLOAD_PRIVATE_KEY_B64
Secret value source: Base64 of the WeChat upload key
```

State that `D:\projects\petcare\.secrets\wechat\private.wx3bdad4ab652f0d1d.key` remains local and ignored; the original root path is no longer used. Provide a PowerShell Base64-to-clipboard command that does not print the value:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\.secrets\wechat\private.wx3bdad4ab652f0d1d.key")) | Set-Clipboard
```

- [ ] **Step 2: Document external WeChat console settings**

Require:

- “小程序代码上传” key remains enabled and is rotated if ever exposed.
- Upload IP whitelist is disabled for GitHub-hosted runners; if it must be enabled later, move upload to a fixed-egress self-hosted runner.
- “request 合法域名” contains `https://admin.petcare-home.com`, without `/api`.
- TLS certificate chain for `admin.petcare-home.com` is valid and publicly trusted.

- [ ] **Step 3: Document the release boundary**

Use this sequence:

```text
GitHub Actions upload -> WeChat development/experience version -> human experience test
-> human review submission -> WeChat approval -> human production release
```

Explicitly state that this workflow does not submit review and does not publish to users automatically.

- [ ] **Step 4: Run documentation and secret-reference checks**

Run:

```bash
pnpm exec prettier --check docs/08-deployment/github-actions-deploy.md docs/08-deployment/deployment.md docs/environment-variables.md SECURITY-CHECKLIST.md
rg -n "MP_APPID|MP_UPLOAD_PRIVATE_KEY_B64|admin.petcare-home.com|体验版本|审核" docs/08-deployment docs/environment-variables.md SECURITY-CHECKLIST.md
rg -n "MP_UPLOAD_PRIVATE_KEY(?!_B64)|miniprogram-ci@latest" .github docs scripts apps/miniapp --pcre2
git diff --check
```

Expected: documentation checks pass; the negative search has no output except historical design/plan text, which is not an executable secret reference.

- [ ] **Step 5: Commit the Miniapp release runbook**

```bash
git add docs/08-deployment/github-actions-deploy.md docs/08-deployment/deployment.md docs/environment-variables.md SECURITY-CHECKLIST.md
git commit -m "docs(miniapp): 补充微信上传与人工发布流程"
```
