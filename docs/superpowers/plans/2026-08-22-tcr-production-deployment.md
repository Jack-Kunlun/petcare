# TCR Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing manual Server/Admin/Website release and independent Miniapp upload workflows while moving all production container delivery from GHCR, Docker Hub, and server-side Git access to private TCR repositories and an SSH-delivered immutable release bundle.

**Architecture:** GitHub Actions resolves one CI-approved full SHA, builds selected application images, mirrors missing runtime images into TCR, and transfers a four-path deployment archive over the existing host-key-pinned SSH connection. Ubuntu keeps configuration and data under `/opt/petcare`, switches an atomic `current` symlink between immutable releases, and uses a temporary Docker credential directory to pull only from TCR. Existing backup, forward-only migration, health, HTTPS, and image rollback behavior remains in the release script.

**Tech Stack:** GitHub Actions, TCR Personal Edition, Docker Buildx, Docker Compose v2, Bash, Python 3 standard library, OpenSSH, OpenSSL, systemd, Node.js built-in policy tests.

**Spec:** `docs/superpowers/specs/2026-08-22-tcr-production-deployment-design.md`

## Global Constraints

- Work on a feature branch based on the current `master`. Before integration, rebase the feature branch onto the latest `master`, then update `master` only with `git merge --ff-only`. Never create a merge commit or use a non-rebase pull.
- Keep the existing manual inputs exactly: `ref`, `target=all|server|admin|website`, and `initialize_data`.
- Preserve the full-SHA CI gate and image tag `sha-` followed by the complete 40-character SHA.
- Use only `ccr.ccs.tencentyun.com` and one validated private TCR namespace. Production servers must not contact GitHub, GHCR, or Docker Hub.
- Keep TCR push and pull credentials separate. Push credentials belong only to image-preparation jobs; pull credentials belong only to the deploy job and temporary remote Docker configuration.
- Never read, print, commit, archive, or copy local TLS private keys, the Miniapp upload key, TCR passwords, SSH private keys, production `.env`, database volumes, or logs outside their explicit secret transport path.
- Do not add a deployment framework, custom archive package, VPN, proxy, Harbor, Kubernetes, or a second policy-test harness. Reuse Bash, Python's standard library, Docker, OpenSSH, and the existing `node:test` files.
- Do not dispatch production from an intermediate Task commit; Tasks 1–7 form one migration candidate and become deployable only after Task 8 verification and successful remote CI.
- Keep PostgreSQL migrations forward-only. Application rollback must not claim or attempt schema rollback.
- Keep `.github/workflows/miniapp-release.yml` independent: no Docker image, TCR repository, Ubuntu deployment, or automatic WeChat review/publication.
- Do not delete the old GitHub Deploy Key or GHCR Secrets until the first TCR release, a second release, and a rollback drill all pass.
- If the execution environment has not already created the implementation branch, start from the current local `master` with `git switch -c codex/tcr-production-deploy` before Task 1.

---

### Task 1: Fix the Compose project and TCR runtime-image contract

**Files:**

- Modify: `scripts/compose-policy.test.mjs`
- Modify: `docker-compose.yml`

**Interfaces:**

- Consumes: production `IMAGE_REGISTRY=ccr.ccs.tencentyun.com/TCR_NAMESPACE`.
- Produces: the fixed Compose project `petcare`, three SHA-tagged application images, and PostgreSQL/Redis/Nginx images from the same registry in production.

- [ ] **Step 1: Add a failing Compose policy test**

Add this test near the existing image-tag test in `scripts/compose-policy.test.mjs`:

```javascript
test("生产 Compose 固定项目名并从同一仓库读取运行时镜像", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");

  assert.match(compose, /^name: petcare$/m);
  assert.match(
    serviceBlock(compose, "postgres"),
    /image: \$\{IMAGE_REGISTRY:-docker\.io\/library\}\/postgres:15-alpine/,
  );
  assert.match(
    serviceBlock(compose, "redis"),
    /image: \$\{IMAGE_REGISTRY:-docker\.io\/library\}\/redis:7-alpine/,
  );
  for (const service of ["website-gateway", "edge-gateway"]) {
    assert.match(
      serviceBlock(compose, service),
      /image: \$\{IMAGE_REGISTRY:-docker\.io\/library\}\/nginx:alpine/,
    );
  }
});
```

The `docker.io/library` default is only for local Compose use. Production always supplies the full private TCR namespace through `IMAGE_REGISTRY`.

- [ ] **Step 2: Run the focused test and confirm the contract is absent**

Run:

```bash
node --test scripts/compose-policy.test.mjs
```

Expected: FAIL because `name: petcare` is absent and runtime images still use public short names.

- [ ] **Step 3: Apply the minimum Compose change**

Add this first line to `docker-compose.yml`:

```yaml
name: petcare
```

Replace only the four runtime image declarations:

```yaml
postgres:
  image: ${IMAGE_REGISTRY:-docker.io/library}/postgres:15-alpine

redis:
  image: ${IMAGE_REGISTRY:-docker.io/library}/redis:7-alpine

website-gateway:
  image: ${IMAGE_REGISTRY:-docker.io/library}/nginx:alpine

edge-gateway:
  image: ${IMAGE_REGISTRY:-docker.io/library}/nginx:alpine
```

Retain every existing volume, health check, network, port, build, and application tag declaration.

- [ ] **Step 4: Verify Compose policy and rendering**

Run:

```bash
node --test scripts/compose-policy.test.mjs
docker compose --env-file .env.example config --quiet
git diff --check
```

Expected: all commands exit `0`; rendered Compose uses project name `petcare` and remains valid.

- [ ] **Step 5: Commit the Compose contract**

```bash
git add scripts/compose-policy.test.mjs docker-compose.yml
git diff --cached --check
git commit -m "fix(deploy): 固定 TCR 运行时镜像契约"
```

---

### Task 2: Make backup and restore operations follow the active release

**Files:**

- Modify: `scripts/database-operations-policy.test.mjs`
- Modify: `scripts/database-backup.sh`
- Modify: `scripts/database-restore.sh`
- Modify: `deploy/systemd/petcare-backup.service`

**Interfaces:**

- Consumes: control files from `/opt/petcare/current`, persistent `.env` and `.deploy-images.env` from `/opt/petcare`, and COS credentials from `/etc/petcare-backup.env`.
- Produces: the existing validated COS backup and temporary-database restore behavior without binding systemd to one release directory.

- [ ] **Step 1: Replace path assertions with the release-aware contract**

In both backup and restore tests, require these constants and working directory:

```javascript
assert.match(script, /^ROOT_DIR="\/opt\/petcare"$/m);
assert.match(script, /^RELEASE_DIR="\$ROOT_DIR\/current"$/m);
assert.match(script, /^ENV_FILE="\$ROOT_DIR\/\.env"$/m);
assert.match(script, /^STATE_FILE="\$ROOT_DIR\/\.deploy-images\.env"$/m);
assert.deepEqual(script.match(/^cd .+$/gm), ['cd "$RELEASE_DIR"']);
assert.match(script, /docker compose --env-file "\$ENV_FILE"/);
```

Update the state-file assertions to require `"$STATE_FILE"` rather than a release-local `.deploy-images.env`. Update the systemd assertion to:

```javascript
assert.deepEqual(service.match(/^ExecStart=.*$/gm), [
  "ExecStart=/opt/petcare/current/scripts/database-backup.sh",
]);
```

Delete the old assertion that requires `ExecStart=/opt/petcare/scripts/database-backup.sh`. Keep every dump validation, upload, restore-isolation, cleanup, and timer assertion unchanged.

- [ ] **Step 2: Run the database policy test and confirm it fails on old paths**

```bash
node --test scripts/database-operations-policy.test.mjs
```

Expected: FAIL on `/opt/petcare` as the working tree and the old systemd `ExecStart`.

- [ ] **Step 3: Update both scripts without changing database behavior**

Use this header in `scripts/database-backup.sh`:

```bash
ROOT_DIR="/opt/petcare"
RELEASE_DIR="$ROOT_DIR/current"
ENV_FILE="$ROOT_DIR/.env"
STATE_FILE="$ROOT_DIR/.deploy-images.env"
BACKUP_DIR="/var/lib/petcare-backups"
BACKUP_ENV="/etc/petcare-backup.env"
```

Then use:

```bash
cd "$RELEASE_DIR"
test -r "$ENV_FILE"
test -r "$BACKUP_ENV"

if [[ -r "$STATE_FILE" ]]; then
  if grep -Ev '^$|^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' "$STATE_FILE" > /dev/null; then
    echo "Invalid .deploy-images.env" >&2
    exit 1
  else
    status=$?
    [[ "$status" -eq 1 ]] || exit 1
  fi
  source "$STATE_FILE"
  export IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG
fi
```

Replace every backup-script Compose call with `docker compose --env-file "$ENV_FILE"`. Apply the same four path constants, `cd "$RELEASE_DIR"`, state validation/source, and explicit env-file argument in `scripts/database-restore.sh`. Do not alter the object-key grammar, dump format, temporary restore database, migration status check, or cleanup traps.

- [ ] **Step 4: Point systemd at the current release**

Change only this line in `deploy/systemd/petcare-backup.service`:

```ini
ExecStart=/opt/petcare/current/scripts/database-backup.sh
```

- [ ] **Step 5: Verify scripts and database policy**

```bash
bash -n scripts/database-backup.sh
bash -n scripts/database-restore.sh
node --test scripts/database-operations-policy.test.mjs
git diff --check
```

Expected: syntax and policy checks pass; no backup credential appears in either script or systemd unit.

- [ ] **Step 6: Commit the release-aware operations**

```bash
git add scripts/database-operations-policy.test.mjs scripts/database-backup.sh scripts/database-restore.sh deploy/systemd/petcare-backup.service
git diff --cached --check
git commit -m "fix(deploy): 让备份跟随当前发布版本"
```

---

### Task 3: Make Ubuntu initialization independent of GitHub and Docker's external APT repository

**Files:**

- Modify: `scripts/deploy-policy.test.mjs`
- Modify: `scripts/server-init.sh`

**Interfaces:**

- Consumes: Ubuntu's already configured APT sources and an interactive or environment-provided initial administrator phone.
- Produces: Docker Engine with Compose v2, Python 3 for archive validation, persistent production directories, and a root-owned `.env`; it does not clone code, install backup units, or start the application.

- [ ] **Step 1: Replace the old root Git SSH test with a source-free initialization test**

Replace `初始化持久化 root Git SSH 契约，并记录可信 SSH 运维前提` with:

```javascript
test("服务器初始化不依赖 GitHub、Git 或外部 Docker APT 源", async () => {
  const init = await readFile(resolve(root, "scripts/server-init.sh"), "utf8");

  assert.doesNotMatch(init, /REPO_URL|ROOT_DEPLOY_KEY|ROOT_KNOWN_HOSTS|github\.com/);
  assert.doesNotMatch(init, /(?:^|\n)\s*(?:git|ssh-keygen)\b/m);
  assert.doesNotMatch(init, /download\.docker\.com|docker-ce|docker-compose-plugin/);
  assert.match(init, /apt-get install -y[\s\S]*docker\.io[\s\S]*docker-compose-v2/);
  assert.match(init, /apt-get install -y[\s\S]*python3/);
  assert.match(init, /docker compose version/);

  const composeCheck = position(init, "docker compose version");
  const createRoot = position(init, 'install -d -o root -g root -m 755 "$INSTALL_DIR"');
  assert.ok(composeCheck < createRoot);

  for (const path of ["releases", "certs", "logs"]) {
    assert.match(init, new RegExp(`\\$INSTALL_DIR/${path}`));
  }
  assert.doesNotMatch(init, /petcare-backup\.(?:service|timer)/);
  assert.doesNotMatch(init, /docker compose[^\n]*(?:up|start)/);
});

test("部署 SSH 仍要求可信主机身份和受限 sudo", async () => {
  const docs = await readFile(resolve(root, "docs/08-deployment/github-actions-deploy.md"), "utf8");

  assert.match(docs, /不要只信任 `ssh-keyscan`/);
  assert.match(docs, /authorized_keys/);
  assert.match(docs, /NOPASSWD: ALL/);
  assert.match(docs, /root 等价/);
  assert.match(docs, /DEPLOY_HOST_FINGERPRINT/);
  assert.match(docs, /带外/);
});
```

These documentation assertions concern the GitHub Actions-to-server SSH connection, not server-to-GitHub access, so they remain required after the repository key is removed.

- [ ] **Step 2: Run the focused policy test and confirm old Git behavior is caught**

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL because `server-init.sh` still requires a GitHub key, clones the repository, and configures `download.docker.com`.

- [ ] **Step 3: Replace the initialization preamble and package installation**

Keep the existing `.env` field set and random-secret generation, but replace all repository/SSH setup with:

```bash
set -Eeuo pipefail

INSTALL_DIR="/opt/petcare"

log() { echo -e "\033[36m[init]\033[0m $*"; }
ok() { echo -e "\033[32m[ok]\033[0m $*"; }
err() { echo -e "\033[31m[err]\033[0m $*" >&2; }

if [[ $EUID -ne 0 ]]; then
  if sudo -n true 2>/dev/null; then
    exec sudo bash "$0" "$@"
  fi
  err "请用 sudo 执行：sudo bash $0"
  exit 1
fi

umask 077
apt-get update -y
if ! apt-get install -y ca-certificates curl openssl python3 docker.io docker-compose-v2; then
  err "当前 Ubuntu APT 源无法提供 Docker Engine 与 Compose v2；请先修复系统软件源"
  exit 1
fi
systemctl enable --now docker
docker --version
docker compose version

install -d -o root -g root -m 755 "$INSTALL_DIR"
install -d -o root -g root -m 755 "$INSTALL_DIR/releases"
install -d -o root -g root -m 700 "$INSTALL_DIR/certs"
install -d -o root -g root -m 755 "$INSTALL_DIR/logs"
cd "$INSTALL_DIR"
```

The Docker and Compose checks must run before the first `/opt/petcare` write. Do not add a fallback repository or download a convenience installer.

- [ ] **Step 4: Keep `.env` creation interactive-safe and persistent**

Before validating `DEFAULT_ADMIN_PHONE`, use:

```bash
DEFAULT_ADMIN_PHONE="${DEFAULT_ADMIN_PHONE:-}"
if [[ -z "$DEFAULT_ADMIN_PHONE" && -t 0 ]]; then
  read -r -p "初始管理员手机号：" DEFAULT_ADMIN_PHONE
fi
: "${DEFAULT_ADMIN_PHONE:?请提供初始管理员中国大陆手机号}"
```

Retain the existing phone regex, generated passwords, complete `.env` here-document, root ownership, and mode `600`. Remove all chmod or systemd installation commands that target release scripts because no release exists during initialization.

Update the final success summary to name the persistent root, `.env`, `releases`, `certs`, and `logs`; remove any claim that source code was cloned or that the backup timer is already installed.

- [ ] **Step 5: Verify initialization is source-free**

```bash
bash -n scripts/server-init.sh
node --test scripts/deploy-policy.test.mjs
rg -n "REPO_URL|github\.com|git clone|git fetch|download\.docker\.com|docker-ce" scripts/server-init.sh
git diff --check
```

Expected: the first two commands pass, `rg` has no output, and diff hygiene passes.

- [ ] **Step 6: Commit the initialization change**

```bash
git add scripts/deploy-policy.test.mjs scripts/server-init.sh
git diff --cached --check
git commit -m "fix(deploy): 移除服务器 GitHub 初始化依赖"
```

---

### Task 4: Run releases from `current` and pull mirrored infrastructure only on first deployment

**Files:**

- Modify: `scripts/deploy-policy.test.mjs`
- Modify: `scripts/release-production.sh`

**Interfaces:**

- Consumes: `/opt/petcare/current`, root `.env`, root `.deploy-images.env`, the selected target, and immutable TCR image tags.
- Produces: the existing ordered backup/migration/health/state transaction plus first-deploy runtime image pulls and image rollback from the candidate release.

- [ ] **Step 1: Add release-layout and initial-runtime assertions**

Extend the first release-policy test with:

```javascript
assert.match(script, /^ROOT_DIR="\/opt\/petcare"$/m);
assert.match(script, /^RELEASE_DIR="\$ROOT_DIR\/current"$/m);
assert.match(script, /^ENV_FILE="\$ROOT_DIR\/\.env"$/m);
assert.match(script, /^STATE_FILE="\$ROOT_DIR\/\.deploy-images\.env"$/m);
assert.match(script, /^cd "\$RELEASE_DIR"$/m);
assert.match(script, /docker compose --env-file "\$ENV_FILE"/);
assert.match(script, /^INFRA_SERVICES=\(postgres redis website-gateway edge-gateway\)$/m);
assert.match(
  script,
  /HAD_STATE" == false[\s\S]*TARGET" == all[\s\S]*pull "\$\{INFRA_SERVICES\[@\]\}"/,
);
```

Update these existing expected fragments:

```javascript
const candidate = position(script, 'CANDIDATE_STATE="$(mktemp "$ROOT_DIR/.deploy-images.XXXXXX")"');
const backup = position(script, '"$RELEASE_DIR/scripts/database-backup.sh"');
```

Keep the existing order assertion: initialization guard, backup, migration, final container wait, HTTP checks, HTTPS checks, then state persistence.

- [ ] **Step 2: Confirm the current script fails the new path contract**

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL because the script still treats `/opt/petcare` as both persistent root and release tree and has no explicit infrastructure pull.

- [ ] **Step 3: Introduce only the necessary root/release path split**

Replace the current path declarations with:

```bash
ROOT_DIR="/opt/petcare"
RELEASE_DIR="$ROOT_DIR/current"
ENV_FILE="$ROOT_DIR/.env"
STATE_FILE="$ROOT_DIR/.deploy-images.env"
STATE_KEYS=(IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG)
INFRA_SERVICES=(postgres redis website-gateway edge-gateway)
```

Then:

```bash
cd "$RELEASE_DIR"
test -r "$ENV_FILE"
```

Use `mktemp "$ROOT_DIR/.deploy-images.XXXXXX"`, call the backup as:

```bash
BACKUP_RUNNER_IMAGE="$IMAGE_REGISTRY/server:$SERVER_IMAGE_TAG" \
  "$RELEASE_DIR/scripts/database-backup.sh"
```

Replace every Compose invocation with `docker compose --env-file "$ENV_FILE"`. Do not change target-to-service mappings, state parsing, rollback tags, migration commands, seed guard, health checks, or public HTTPS checks.

- [ ] **Step 4: Pull runtime images only for the initial full deployment**

Immediately after the candidate state is built and before any container start, use:

```bash
docker compose --env-file "$ENV_FILE" config --quiet
DEPLOYMENT_STARTED=true
docker compose --env-file "$ENV_FILE" pull "${APP_SERVICES[@]}"
if [[ "$HAD_STATE" == false && "$TARGET" == all ]]; then
  docker compose --env-file "$ENV_FILE" pull "${INFRA_SERVICES[@]}"
fi
docker compose --env-file "$ENV_FILE" up -d --no-build --wait --wait-timeout 180 postgres redis
```

Subsequent selective and full application releases reuse the fixed runtime tags already present in TCR and on the host.

- [ ] **Step 5: Verify release ordering and syntax**

```bash
bash -n scripts/release-production.sh
node --test scripts/deploy-policy.test.mjs
git diff --check
```

Expected: checks pass; the test still proves state is written only after all health and HTTPS checks.

- [ ] **Step 6: Commit the current-release behavior**

```bash
git add scripts/deploy-policy.test.mjs scripts/release-production.sh
git diff --cached --check
git commit -m "fix(deploy): 从当前发布目录执行生产事务"
```

---

### Task 5: Move application and runtime image preparation to TCR

**Files:**

- Modify: `scripts/deploy-policy.test.mjs`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: Environment Variables `TCR_REGISTRY`, `TCR_NAMESPACE`; push Secrets in build/runtime jobs; pull Secrets only in deploy.
- Produces: selected SHA-tagged application images and three missing-only runtime images in private TCR repositories before SSH deployment starts.

- [ ] **Step 1: Replace GHCR permission and credential assertions**

Update the job-permission test to require only:

```javascript
assert.match(buildJob, /^ {4}permissions:\r?\n {6}contents: read\r?$/m);
assert.doesNotMatch(buildJob, /packages: write/);
```

Add a `runtime-images` job block and this credential-separation test:

```javascript
test("TCR 推送与拉取凭据严格分离", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");
  const build = workflowJobBlock(workflow, "build");
  const runtime = workflowJobBlock(workflow, "runtime-images");
  const deploy = workflowJobBlock(workflow, "deploy");

  for (const job of [build, runtime]) {
    assert.match(job, /environment: production/);
    assert.match(job, /secrets\.TCR_PUSH_USERNAME/);
    assert.match(job, /secrets\.TCR_PUSH_PASSWORD/);
    assert.doesNotMatch(job, /TCR_PULL_/);
  }
  assert.match(deploy, /secrets\.TCR_PULL_USERNAME/);
  assert.match(deploy, /secrets\.TCR_PULL_PASSWORD/);
  assert.doesNotMatch(deploy, /TCR_PUSH_/);

  assert.doesNotMatch(workflow, /ghcr\.io|GHCR_PULL_|packages: write/);
  assert.match(workflow, /TCR_REGISTRY: \$\{\{ vars\.TCR_REGISTRY \}\}/);
  assert.match(workflow, /TCR_NAMESPACE: \$\{\{ vars\.TCR_NAMESPACE \}\}/);
  assert.match(workflow, /ccr\.ccs\.tencentyun\.com/);
  assert.match(workflow, /\^\[a-z0-9\]\+\(\[\._-\]\[a-z0-9\]\+\)\*\$/);
});
```

Add a runtime mirror assertion:

```javascript
for (const image of ["postgres:15-alpine", "redis:7-alpine", "nginx:alpine"]) {
  assert.ok(workflow.includes(image));
}
assert.match(workflow, /docker manifest inspect/);
assert.match(workflow, /manifest unknown\|no such manifest\|not found/);
assert.match(workflow, /needs: \[resolve, build, runtime-images\]/);
```

- [ ] **Step 2: Run the deploy policy and confirm GHCR is rejected**

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL on GHCR login, `packages: write`, missing TCR variables, and missing runtime job.

- [ ] **Step 3: Resolve and validate the exact TCR registry path**

Bind `resolve` to the production environment and add:

```yaml
environment: production
env:
  TCR_REGISTRY: ${{ vars.TCR_REGISTRY }}
  TCR_NAMESPACE: ${{ vars.TCR_NAMESPACE }}
```

Inside the metadata step, before writing outputs:

```bash
[[ "$TCR_REGISTRY" == "ccr.ccs.tencentyun.com" ]]
[[ ${#TCR_NAMESPACE} -ge 2 && ${#TCR_NAMESPACE} -le 30 ]]
[[ "$TCR_NAMESPACE" =~ ^[a-z0-9]+([._-][a-z0-9]+)*$ ]]
```

Expose both values:

```bash
echo "registry_host=$TCR_REGISTRY"
echo "registry=$TCR_REGISTRY/$TCR_NAMESPACE"
```

Add `registry_host` to job outputs and retain the full SHA, services, and immutable image tag outputs.

- [ ] **Step 4: Change the build matrix to the push-only identity**

The build job must include:

```yaml
environment: production
permissions:
  contents: read
env:
  TCR_PUSH_USERNAME: ${{ secrets.TCR_PUSH_USERNAME }}
  TCR_PUSH_PASSWORD: ${{ secrets.TCR_PUSH_PASSWORD }}
```

Use the existing Docker login action:

```yaml
- uses: docker/login-action@v3
  with:
    registry: ${{ needs.resolve.outputs.registry_host }}
    username: ${{ env.TCR_PUSH_USERNAME }}
    password: ${{ env.TCR_PUSH_PASSWORD }}
```

Keep the existing Buildx cache and push each selected image to:

```yaml
tags: ${{ needs.resolve.outputs.registry }}/${{ matrix.service }}:${{ needs.resolve.outputs.image_tag }}
```

- [ ] **Step 5: Add the missing-only runtime mirror matrix**

Add a job alongside `build`:

```yaml
runtime-images:
  name: 准备运行时镜像 ${{ matrix.repository }}
  needs: resolve
  runs-on: ubuntu-latest
  environment: production
  permissions:
    contents: read
  env:
    TCR_PUSH_USERNAME: ${{ secrets.TCR_PUSH_USERNAME }}
    TCR_PUSH_PASSWORD: ${{ secrets.TCR_PUSH_PASSWORD }}
  strategy:
    fail-fast: false
    matrix:
      include:
        - source: postgres:15-alpine
          repository: postgres
          tag: 15-alpine
        - source: redis:7-alpine
          repository: redis
          tag: 7-alpine
        - source: nginx:alpine
          repository: nginx
          tag: alpine
  steps:
    - uses: docker/login-action@v3
      with:
        registry: ${{ needs.resolve.outputs.registry_host }}
        username: ${{ env.TCR_PUSH_USERNAME }}
        password: ${{ env.TCR_PUSH_PASSWORD }}
    - name: 仅在 TCR 缺少标签时同步
      shell: bash
      env:
        SOURCE_IMAGE: ${{ matrix.source }}
        DESTINATION_IMAGE: ${{ needs.resolve.outputs.registry }}/${{ matrix.repository }}:${{ matrix.tag }}
      run: |
        set -Eeuo pipefail
        probe_error="$(mktemp)"
        trap 'rm -f -- "$probe_error"' EXIT
        if docker manifest inspect "$DESTINATION_IMAGE" > /dev/null 2> "$probe_error"; then
          echo "TCR runtime image already exists; skip overwrite"
        elif grep -Eiq 'manifest unknown|no such manifest|not found' "$probe_error"; then
          docker pull "$SOURCE_IMAGE"
          docker tag "$SOURCE_IMAGE" "$DESTINATION_IMAGE"
          docker push "$DESTINATION_IMAGE"
        else
          sed 's/[^[:print:]]//g' "$probe_error" >&2
          exit 1
        fi
```

Do not add scheduled refresh or overwrite an existing fixed runtime tag.

- [ ] **Step 6: Replace deployment-side GHCR login with the pull-only TCR identity**

Make deploy wait for all image work:

```yaml
needs: [resolve, build, runtime-images]
```

Replace the GHCR environment entries with:

```yaml
TCR_PULL_USERNAME: ${{ secrets.TCR_PULL_USERNAME }}
TCR_PULL_PASSWORD: ${{ secrets.TCR_PULL_PASSWORD }}
```

Validate both as non-empty, write only the password to `$DEPLOY_TMP/tcr-pull.password` with mode `600`, transfer it through the existing pinned SSH path, and log in remotely with:

```bash
sudo env DOCKER_CONFIG="$DOCKER_CONFIG" docker login "$TCR_REGISTRY" \
  -u "$TCR_PULL_USERNAME" --password-stdin < "$REMOTE_TMP/tcr-pull.password"
sudo rm -f -- "$REMOTE_TMP/tcr-pull.password"
```

Pass `TCR_REGISTRY`, full `IMAGE_REGISTRY`, and `TCR_PULL_USERNAME` as validated remote arguments. Keep `DOCKER_CONFIG` under the per-run remote temp directory so the existing cleanup trap removes it.

- [ ] **Step 7: Prove Miniapp remains outside TCR**

Add to `scripts/deploy-policy.test.mjs`:

```javascript
test("Miniapp 发布仍独立于 Docker、TCR 与生产服务器", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/miniapp-release.yml"), "utf8");

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /MP_UPLOAD_PRIVATE_KEY_B64/);
  assert.match(workflow, /build:miniapp:mp-weixin/);
  assert.match(workflow, /miniprogram-ci upload/);
  assert.doesNotMatch(workflow, /TCR_|ccr\.ccs\.tencentyun\.com|docker|ssh|scp/);
});
```

- [ ] **Step 8: Verify TCR policy and workflow syntax-sensitive text**

```bash
node --test scripts/deploy-policy.test.mjs
rg -n "ghcr\.io|GHCR_PULL_|packages: write" .github/workflows/deploy.yml
git diff --check
```

Expected: policy passes, `rg` has no output, and diff hygiene passes.

- [ ] **Step 9: Commit TCR image preparation**

```bash
git add scripts/deploy-policy.test.mjs .github/workflows/deploy.yml
git diff --cached --check
git commit -m "ci(deploy): 将生产镜像迁移到 TCR"
```

---

### Task 6: Deliver an allowlisted archive and switch immutable server releases atomically

**Files:**

- Modify: `scripts/deploy-policy.test.mjs`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: the exact CI-approved SHA and the existing pinned-host SSH connection.
- Produces: `/opt/petcare/releases/SHA`, persistent-data symlinks, atomic `/opt/petcare/current`, application rollback plus release-pointer rollback, and no server-side Git operation.

- [ ] **Step 1: Replace server-Git assertions with archive-boundary assertions**

Replace the old remote Git transaction assertions with:

```javascript
assert.doesNotMatch(workflow, /git fetch|git checkout|git clone|sudo -H git/);
assert.match(
  workflow,
  /git archive --format=tar --output="\$DEPLOY_TMP\/release\.tar" "\$RELEASE_SHA" -- docker-compose\.yml docker scripts deploy/,
);
assert.match(workflow, /from pathlib import PurePosixPath/);
assert.match(workflow, /import sys, tarfile/);
assert.match(workflow, /"docker-compose\.yml", "docker", "scripts", "deploy"/);
assert.match(workflow, /path\.is_absolute\(\) or "\.\." in path\.parts/);
assert.match(workflow, /member\.isfile\(\) or member\.isdir\(\)/);
assert.doesNotMatch(workflow, /git archive[^\n]*(?:\.env|certs|logs|node_modules|apps\/)/);
```

Add release-layout assertions:

```javascript
assert.match(workflow, /RELEASES_DIR="\$INSTALL_DIR\/releases"/);
assert.match(workflow, /RELEASE_DIR="\$RELEASES_DIR\/\$RELEASE_SHA"/);
assert.match(workflow, /ln -s "\$INSTALL_DIR\/\.env" "\$STAGING_DIR\/\.env"/);
assert.match(workflow, /ln -s "\$INSTALL_DIR\/certs" "\$STAGING_DIR\/certs"/);
assert.match(workflow, /ln -s "\$INSTALL_DIR\/logs" "\$STAGING_DIR\/logs"/);
assert.match(workflow, /docker compose --env-file "\$INSTALL_DIR\/\.env" config --quiet/);
assert.match(workflow, /ln -s "releases\/\$RELEASE_SHA" "\$NEXT_CURRENT"/);
assert.match(workflow, /mv -Tf -- "\$NEXT_CURRENT" "\$INSTALL_DIR\/current"/);
assert.match(workflow, /CURRENT_SWITCHED=true/);
assert.match(workflow, /RELEASE_SUCCEEDED=true/);
assert.match(workflow, /恢复上一 release/);
```

Require release execution and systemd paths through `current`:

```javascript
assert.match(workflow, /\/opt\/petcare\/current\/scripts\/release-production\.sh/);
assert.match(workflow, /\/opt\/petcare\/current\/deploy\/systemd\/petcare-backup\.service/);
assert.doesNotMatch(workflow, /\/opt\/petcare\/scripts\/release-production\.sh/);
```

Keep the existing TLS ordering, temporary credential cleanup, backup configuration, health, and timer assertions.

- [ ] **Step 2: Run the policy test and confirm server Git checkout fails the new contract**

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL on server-side `git fetch`/`checkout`, missing archive validation, and missing atomic `current` switch.

- [ ] **Step 3: Checkout the exact SHA and build the four-path archive on the runner**

Add this as the first deploy step:

```yaml
- uses: actions/checkout@v7
  with:
    fetch-depth: 0
    persist-credentials: false
    ref: ${{ needs.resolve.outputs.sha }}
```

After creating `$DEPLOY_TMP`, build the archive:

```bash
git archive --format=tar --output="$DEPLOY_TMP/release.tar" "$RELEASE_SHA" -- docker-compose.yml docker scripts deploy
```

Validate it before SCP with Python's standard library:

```bash
python3 - "$DEPLOY_TMP/release.tar" <<'PY'
from pathlib import PurePosixPath
import sys, tarfile

allowed = {"docker-compose.yml", "docker", "scripts", "deploy"}
with tarfile.open(sys.argv[1], "r:") as archive:
    members = archive.getmembers()
    if not members:
        raise SystemExit("release archive is empty")
    for member in members:
        path = PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts or not path.parts:
            raise SystemExit(f"unsafe archive path: {member.name!r}")
        if path.parts[0] not in allowed:
            raise SystemExit(f"archive path is not allowed: {member.name!r}")
        if path.parts[0] == "docker-compose.yml" and len(path.parts) != 1:
            raise SystemExit(f"invalid compose path: {member.name!r}")
        if any(character in member.name for character in "\r\n"):
            raise SystemExit("archive path contains a control character")
        if not (member.isfile() or member.isdir()):
            raise SystemExit(f"archive member type is not allowed: {member.name!r}")
PY
```

Transfer `release.tar` together with the already validated TLS, backup, and TCR pull credential files. Do not transfer the checked-out directory itself.

- [ ] **Step 4: Validate the archive again before remote extraction**

Run the same Python validation block against `$REMOTE_TMP/release.tar` inside the remote script. The duplicate validation is intentional: runner validation protects artifact creation; remote validation protects the extraction trust boundary. Do not factor it into a file inside the untrusted archive.

- [ ] **Step 5: Stage and validate one immutable release**

Use these bounded paths:

```bash
INSTALL_DIR="/opt/petcare"
RELEASES_DIR="$INSTALL_DIR/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_SHA"
RUN_TOKEN="${REMOTE_TMP#/tmp/petcare-release-}"
STAGING_DIR="$RELEASES_DIR/.incoming-$RELEASE_SHA-$RUN_TOKEN"
NEXT_CURRENT="$INSTALL_DIR/.current-$RUN_TOKEN"
OLD_CURRENT=""
CURRENT_SWITCHED=false
RELEASE_SUCCEEDED=false
```

Validate the SHA and require `RUN_TOKEN` to match `^[0-9]+-[0-9]+$` before composing any release path. Then:

```bash
sudo install -d -o root -g root -m 755 "$RELEASES_DIR"
sudo install -d -o root -g root -m 755 "$STAGING_DIR"
sudo tar -xf "$REMOTE_TMP/release.tar" -C "$STAGING_DIR" \
  --no-same-owner --no-same-permissions
sudo chown -R root:root "$STAGING_DIR"
sudo ln -s "$INSTALL_DIR/.env" "$STAGING_DIR/.env"
sudo ln -s "$INSTALL_DIR/certs" "$STAGING_DIR/certs"
sudo ln -s "$INSTALL_DIR/logs" "$STAGING_DIR/logs"
sudo chmod 0755 \
  "$STAGING_DIR/scripts/release-production.sh" \
  "$STAGING_DIR/scripts/database-backup.sh" \
  "$STAGING_DIR/scripts/database-restore.sh"
```

If `$RELEASE_DIR` already exists, require it to be a root-owned real directory, compare it to the staged directory with `sudo diff -qr --no-dereference`, and remove only the matching staging directory. Otherwise move staging to `$RELEASE_DIR`. A same-SHA rollback may reuse an identical release; a changed directory for the same SHA must fail.

Before switching `current`, run:

```bash
cd "$RELEASE_DIR"
sudo docker compose --env-file "$INSTALL_DIR/.env" config --quiet
```

- [ ] **Step 6: Atomically switch and restore the release pointer**

Before switching, resolve the old pointer only if it exists and require it to match `/opt/petcare/releases/` plus a 40-character lowercase SHA. Switch with:

```bash
sudo ln -s "releases/$RELEASE_SHA" "$NEXT_CURRENT"
sudo mv -Tf -- "$NEXT_CURRENT" "$INSTALL_DIR/current"
CURRENT_SWITCHED=true
```

Extend the remote EXIT trap so that a non-zero status after the switch and before `RELEASE_SUCCEEDED=true` restores the old relative symlink with the same temporary-link-plus-`mv -Tf` pattern and logs `恢复上一 release`. On a first release there is no old pointer; leave the failed candidate and persistent data intact for diagnosis. In all cases remove the remote temp directory, temporary Docker configuration, unused staging directory, and uninstalled next-link path.

- [ ] **Step 7: Install persistent configuration and execute through `current`**

After the switch:

1. Atomically install the already validated TLS files under `/opt/petcare/certs`.
2. Atomically install `/etc/petcare-backup.env`.
3. Install both systemd units from `/opt/petcare/current/deploy/systemd/`.
4. Run `systemctl daemon-reload`.
5. Reload the running edge gateway only after `nginx -t` succeeds.
6. Execute `/opt/petcare/current/scripts/release-production.sh` with the temporary `DOCKER_CONFIG` and validated release inputs.
7. Immediately after the release script exits `0`, set `RELEASE_SUCCEEDED=true`.
8. Run `systemctl enable --now petcare-backup.timer`.

TLS is persistent and intentionally remains updated when an application release rolls back. If timer enablement fails after a healthy release, report the operational failure but do not restore an old `current` pointer against the newly persisted image state.

- [ ] **Step 8: Retain only the successful current and previous release**

After `release-production.sh` succeeds, iterate only direct child directories of `/opt/petcare/releases`. Remove a directory only when its basename matches exactly 40 lowercase hexadecimal characters and its resolved path is neither the new release nor `OLD_CURRENT`. A cleanup failure must emit a warning without rolling back a healthy deployment whose state was already persisted.

- [ ] **Step 9: Verify the complete source-free transaction**

```bash
node --test scripts/deploy-policy.test.mjs
rg -n "git fetch|git checkout|git clone|sudo -H git|ghcr\.io|GHCR_PULL_" .github/workflows/deploy.yml scripts/server-init.sh
git diff --check
```

Expected: policy passes, `rg` has no output, and diff hygiene passes.

- [ ] **Step 10: Commit immutable SSH release delivery**

```bash
git add scripts/deploy-policy.test.mjs .github/workflows/deploy.yml
git diff --cached --check
git commit -m "ci(deploy): 通过 SSH 交付不可变发布包"
```

---

### Task 7: Replace GHCR setup documentation with the exact TCR migration runbook

**Files:**

- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/08-deployment/github-actions-deploy.md`
- Modify: `docker/README.md`
- Modify: `SECURITY-CHECKLIST.md`
- Modify: `scripts/deploy-policy.test.mjs`

**Interfaces:**

- Consumes: the confirmed TCR Personal Edition, GitHub production Environment, existing SSH/TLS/backup setup, and source-free server layout.
- Produces: one ordered operator checklist for provisioning, first release, rollback proof, and delayed removal of legacy access.

- [ ] **Step 1: Add documentation contract assertions**

Add one test that reads the four documents and requires all new configuration names:

```javascript
test("部署文档完整记录 TCR 配置和迁移后清理顺序", async () => {
  const paths = [
    "docs/08-deployment/deployment.md",
    "docs/08-deployment/github-actions-deploy.md",
    "docker/README.md",
    "SECURITY-CHECKLIST.md",
  ];
  const documents = (
    await Promise.all(paths.map((path) => readFile(resolve(root, path), "utf8")))
  ).join("\n");

  for (const name of [
    "TCR_REGISTRY",
    "TCR_NAMESPACE",
    "TCR_PUSH_USERNAME",
    "TCR_PUSH_PASSWORD",
    "TCR_PULL_USERNAME",
    "TCR_PULL_PASSWORD",
  ]) {
    assert.match(documents, new RegExp(name));
  }
  for (const repository of ["server", "admin", "website", "postgres", "redis", "nginx"]) {
    assert.match(documents, new RegExp(`\\b${repository}\\b`));
  }
  assert.match(documents, /保留[^\n]*30/);
  assert.match(documents, /回退演练/);
  assert.match(documents, /删除[^\n]*GHCR_PULL_USER/);
  assert.match(documents, /删除[^\n]*GitHub Deploy Key/);
});
```

- [ ] **Step 2: Confirm the old GHCR guide fails the new contract**

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL because the current guide still configures GHCR and server-side repository access.

- [ ] **Step 3: Rewrite the GitHub Actions deployment guide in operator order**

`docs/08-deployment/github-actions-deploy.md` must contain these numbered sections:

1. Create one globally unique private TCR namespace.
2. Create exactly six private repositories: `server`, `admin`, `website`, `postgres`, `redis`, `nginx`.
3. Configure cleanup to retain the newest 30 tags per repository so the personal-edition limit of 100 tags per repository is not reached.
4. Create `petcare-tcr-push` and `petcare-tcr-pull` CAM subusers with namespace-scoped describe/pull/push versus describe/pull permissions; neither may delete or administer repositories.
5. Initialize separate TCR registry passwords, record UIN usernames, remove temporary password-management permission, and disable console login without disabling either subuser.
6. Verify push can push/pull but not delete and pull can pull but not push before storing credentials.
7. Add `TCR_REGISTRY=ccr.ccs.tencentyun.com` and the chosen `TCR_NAMESPACE` as production Environment Variables.
8. Add the four TCR Secrets, retaining the existing SSH, TLS, backup, Aliyun SMS, and Miniapp Secrets.
9. Initialize Ubuntu by transferring `scripts/server-init.sh` through the existing pinned SSH connection; do not configure server-to-GitHub access.
10. Run first deploy, second deploy, rollback drill, backup/restore drill, then remove old access.

State explicitly that TCR registry username/password are not CAM `SecretId`/`SecretKey`, and never include actual credentials in examples.

- [ ] **Step 4: Align the general deployment, Docker, and security documents**

Update the other three documents to state:

- Production Compose has fixed project name `petcare` and pulls all six image families from the private TCR namespace.
- `/opt/petcare/current` points to immutable releases while `.env`, `.deploy-images.env`, `certs`, `logs`, and named volumes persist outside releases.
- Server initialization uses configured Ubuntu APT sources and requires `docker compose version`; it does not clone the repository.
- The deployment archive contains only `docker-compose.yml`, `docker/`, `scripts/`, and `deploy/`.
- TCR passwords only enter temporary runner/remote locations and temporary Docker configuration.
- Miniapp remains a separate GitHub Actions upload to WeChat.
- Legacy GHCR Secrets and server GitHub Deploy Key remain until migration acceptance and are then removed.

Remove commands that instruct the server to access GitHub, GHCR, or Docker Hub. Retain the existing HTTPS, backup, database safety, SSH host fingerprint, `authorized_keys`, restricted sudo, and production Environment reviewer guidance.

- [ ] **Step 5: Validate documentation and policy**

```bash
node --test scripts/deploy-policy.test.mjs
node node_modules/prettier/bin/prettier.cjs --check docs/08-deployment/deployment.md docs/08-deployment/github-actions-deploy.md docker/README.md SECURITY-CHECKLIST.md
rg -n "ghcr\.io|GHCR_PULL_|git clone|git fetch" docs/08-deployment/deployment.md docs/08-deployment/github-actions-deploy.md docker/README.md SECURITY-CHECKLIST.md
git diff --check
```

Expected: policy and formatting pass. Any remaining `rg` match must only describe the post-acceptance deletion of legacy names; remove operational instructions that still use them.

- [ ] **Step 6: Commit the migration runbook**

```bash
git add docs/08-deployment/deployment.md docs/08-deployment/github-actions-deploy.md docker/README.md SECURITY-CHECKLIST.md scripts/deploy-policy.test.mjs
git diff --cached --check
git commit -m "docs(deploy): 补全 TCR 迁移与验收手册"
```

---

### Task 8: Run release-candidate verification and preserve linear history

**Files:**

- Verify only; modify a file only to fix a failure caused by Tasks 1–7.

**Interfaces:**

- Consumes: the complete candidate branch.
- Produces: a locally verified, CI-ready linear commit series.

- [ ] **Step 1: Run shell syntax and focused deployment checks**

Run in Git Bash, WSL, or an Ubuntu runner:

```bash
bash -n scripts/server-init.sh
bash -n scripts/release-production.sh
bash -n scripts/database-backup.sh
bash -n scripts/database-restore.sh
node --test scripts/compose-policy.test.mjs
node --test scripts/database-operations-policy.test.mjs
node --test scripts/deploy-policy.test.mjs
```

Expected: every command exits `0`.

- [ ] **Step 2: Run the CI-infrastructure risk tier**

```bash
pnpm test:tooling
docker compose --env-file .env.example config --quiet
node node_modules/prettier/bin/prettier.cjs --check .github/workflows/deploy.yml docker-compose.yml scripts/server-init.sh scripts/release-production.sh scripts/database-backup.sh scripts/database-restore.sh scripts/deploy-policy.test.mjs scripts/compose-policy.test.mjs scripts/database-operations-policy.test.mjs docs/08-deployment/deployment.md docs/08-deployment/github-actions-deploy.md docker/README.md SECURITY-CHECKLIST.md
git diff --check
```

Expected: every required check passes. Do not run application E2E locally solely for this CI/deployment change; the three production Docker builds remain required in `ci.yml`.

- [ ] **Step 3: Audit forbidden dependencies and secret paths**

```bash
rg -n "ghcr\.io|GHCR_PULL_|packages: write|git fetch|git checkout|git clone|download\.docker\.com" .github/workflows/deploy.yml scripts/server-init.sh scripts/release-production.sh
git ls-files certs .secrets .env .deploy-images.env
git diff --check
```

Expected: both `rg` and `git ls-files` produce no output; diff hygiene passes.

- [ ] **Step 4: Rebase and integrate without a merge commit**

On the feature branch:

```bash
git fetch origin
git rebase origin/master
```

Re-run invalidated checks after any conflict resolution. If integrating locally, update local `master` only by fast-forward:

```bash
git switch master
git pull --rebase origin master
git merge --ff-only codex/tcr-production-deploy
git rev-list --min-parents=2 master
```

Expected: the merge command fast-forwards and the final history command has no output. On GitHub, use only Rebase and merge or Squash and merge; never Create a merge commit.

If integration happens through a GitHub PR instead, do not also run the local integration commands. Rebase the branch first, then use only Rebase and merge or Squash and merge; never Create a merge commit.

- [ ] **Step 5: Require remote CI before production use**

Push the linear candidate, wait for `ci.yml`, and record the exact successful 40-character SHA. Do not dispatch production deployment for a SHA without a successful CI run.

---

### Task 9: Provision TCR and perform the staged production migration

**Files:**

- External configuration only; do not change repository files during this task.

**Interfaces:**

- Consumes: the CI-approved implementation SHA, TCR resources, GitHub production Environment, existing SSH/TLS/backup Secrets, and the Ubuntu server.
- Produces: a verified seven-container HTTPS deployment with backup/restore and rollback evidence, followed by removal of obsolete GitHub/GHCR access.

- [ ] **Step 1: Provision and verify TCR before adding GitHub Secrets**

In Tencent Cloud:

1. Create the private namespace and the six private repositories.
2. Enable the newest-30 tag cleanup policy and record the personal-edition limit of 100 tags per repository in the operator checklist.
3. Create the push and pull CAM subusers and attach only namespace-scoped actions from the design spec.
4. Initialize separate personal-registry passwords and record each UIN username in a password manager.
5. With a temporary private permission-probe repository, prove the push identity can push and pull, the pull identity can pull, the pull identity cannot push, and neither identity can delete or administer repositories.
6. Delete the temporary probe repository as the administrator, remove temporary password-management permissions, and disable subuser console login.

Do not create CAM API SecretId/SecretKey pairs for this deployment.

- [ ] **Step 2: Add the production Environment configuration**

Add Environment Variable `TCR_REGISTRY` with the exact value `ccr.ccs.tencentyun.com`. Add Environment Variable `TCR_NAMESPACE` by copying the exact namespace already recorded from Tencent Cloud; do not add whitespace or a registry prefix.

Add Secrets:

```text
TCR_PUSH_USERNAME
TCR_PUSH_PASSWORD
TCR_PULL_USERNAME
TCR_PULL_PASSWORD
```

Keep `GHCR_PULL_USER`, `GHCR_PULL_TOKEN`, and the old Deploy Key until Step 7. Confirm required reviewers and the `master` deployment branch restriction remain enabled.

- [ ] **Step 3: Transfer and run source-free server initialization**

From Windows PowerShell, using the already tested SSH identity:

```powershell
$deployHost = "43.136.101.180"
$deployUser = "petcare-deploy"
$deployKey = Join-Path $env:USERPROFILE ".ssh\petcare-github-actions"
scp -i $deployKey -o IdentitiesOnly=yes `
  "D:\projects\petcare\scripts\server-init.sh" `
  "${deployUser}@${deployHost}:/tmp/petcare-server-init.sh"
ssh -i $deployKey -o IdentitiesOnly=yes "${deployUser}@${deployHost}"
```

On Ubuntu:

```bash
sudo bash /tmp/petcare-server-init.sh
sudoedit /opt/petcare/.env
sudo test -r /opt/petcare/.env
sudo docker compose version
```

Enter the administrator phone only at the interactive prompt. Complete the existing WeChat, Aliyun SMS, COS, URL, and production secret values in `sudoedit`; do not print or paste them into this task. Remove `/tmp/petcare-server-init.sh` after successful initialization.

- [ ] **Step 4: Perform the first full release**

In GitHub Actions, dispatch `手动生产发布`. Paste the recorded CI-approved 40-character SHA into `ref`, select `target=all`, and select `initialize_data=true`.

Require all jobs to pass. On Ubuntu, verify without exposing credentials:

```bash
sudo docker compose --project-directory /opt/petcare/current \
  --env-file /opt/petcare/.env ps
sudo readlink -f /opt/petcare/current
sudo systemctl status petcare-backup.timer --no-pager
sudo find /opt/petcare -maxdepth 2 -type d -printf '%M %u:%g %p\n'
```

Expected: PostgreSQL, Redis, Server, Admin, Website, Website Gateway, and Edge Gateway are healthy; `current` resolves to the deployed 40-character SHA; persistent `.env`, certificates, logs, and volumes remain outside the release.

- [ ] **Step 5: Verify public HTTPS and backup recovery**

From a network outside the server:

```bash
curl --head --max-redirs 0 http://petcare-home.com/
curl --head --max-redirs 0 http://www.petcare-home.com/
curl --head --max-redirs 0 http://admin.petcare-home.com/
curl --fail --location --proto '=https' --tlsv1.2 https://petcare-home.com/ --output /dev/null
curl --fail --location --proto '=https' --tlsv1.2 https://www.petcare-home.com/ --output /dev/null
curl --fail --location --proto '=https' --tlsv1.2 https://admin.petcare-home.com/ --output /dev/null
curl --fail --location --proto '=https' --tlsv1.2 https://admin.petcare-home.com/api/ready --output /dev/null
```

Expected: all HTTP requests return exact `301` HTTPS locations and all HTTPS requests succeed with publicly trusted certificates. Trigger one backup, select its explicit COS object key, and run the documented temporary-database restore drill; production data must remain unchanged.

- [ ] **Step 6: Prove repeat deployment and rollback**

After one later CI-approved application commit:

1. Run a second successful release.
2. Record both release SHAs and confirm `/opt/petcare/releases` retains both.
3. Dispatch the previous successful SHA with `initialize_data=false` and the required target.
4. Verify application image tags, `/opt/petcare/current`, seven-container health, HTTP redirects, HTTPS, and API readiness.

If migration ran, confirm it remains in place and no automated database rollback was claimed.

- [ ] **Step 7: Remove legacy access only after all acceptance checks pass**

Then, and only then:

1. Delete the server read-only GitHub Deploy Key from repository settings.
2. Delete `/root/.ssh/petcare-readonly` and its matching public key on the server after resolving the exact files.
3. Remove only the obsolete GitHub host entry or dedicated known-hosts file used by that key.
4. Delete `GHCR_PULL_USER` and `GHCR_PULL_TOKEN` from the production Environment.
5. Remove the old root Git worktree files under `/opt/petcare` only after confirming persistent `.env`, `.deploy-images.env`, `certs`, `logs`, `releases`, and Docker named volumes are outside the deletion target. Do not delete `/opt/petcare` itself.
6. Confirm `/opt/petcare` no longer contains `.git` and the system Docker configuration has no persistent TCR credential.

These deletions are production operations: resolve and verify every literal target immediately before removal.

- [ ] **Step 8: Prove the final no-GitHub server boundary**

Run one non-database selective deployment, such as `target=admin`, with `initialize_data=false`. It must succeed after legacy GitHub credentials are gone. Confirm the server only pulls from `ccr.ccs.tencentyun.com`, all public endpoints remain HTTPS, and the Miniapp workflow still uploads independently to WeChat.

## Spec Coverage Check

| Confirmed requirement                                           | Implemented by      |
| --------------------------------------------------------------- | ------------------- |
| Manual full or selective Docker application release             | Tasks 4–6           |
| Six private TCR repositories and missing-only runtime mirroring | Tasks 1, 5, 9       |
| Push/pull credential separation and temporary login state       | Tasks 5, 6, 9       |
| No server access to GitHub, GHCR, or Docker Hub                 | Tasks 1, 3, 5, 6, 9 |
| Four-path allowlisted archive and persistent-data isolation     | Task 6              |
| Atomic `current` switch and previous-release restoration        | Task 6              |
| Fixed Compose project and seven stable containers               | Tasks 1, 4, 9       |
| Backup, migration, seed, health, HTTPS, and state order         | Tasks 2, 4, 6, 9    |
| TLS remains independent of application rollback                 | Tasks 6, 9          |
| Independent Miniapp build/upload                                | Tasks 5, 7, 9       |
| Delayed legacy-key and GHCR-secret cleanup                      | Tasks 7, 9          |
| Linear `master` history                                         | Task 8              |
