# Main Application Deploy and HTTPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manually publish any CI-approved Server, Admin, or Website revision through independent immutable images, automatically install TLS and backup secrets, and expose the production system only through HTTPS on ports 80/443.

**Architecture:** A GitHub Actions workflow resolves the selected ref to one full commit SHA, verifies that SHA's CI success, builds only selected images, and deploys through native OpenSSH with pinned host identity. A tested server-side release script owns selective tag state, pre-migration backup, `migrate deploy`, health waits, HTTPS smoke checks, rollback of application images, and atomic state persistence; Nginx remains the single TLS edge.

**Tech Stack:** GitHub Actions, GHCR, Docker Buildx, Docker Compose, Bash, OpenSSH, OpenSSL, Nginx Alpine, Node.js built-in policy tests.

**Spec:** `docs/superpowers/specs/2026-08-20-production-deployment-release-design.md`

## Global Constraints

- Execute `2026-08-20-production-runtime-data-safety.md` and `2026-08-20-database-backup-operations.md` first; this release workflow calls their migration and backup commands.
- The workflow is manually triggered and accepts `ref`, `target=all|server|admin|website`, and `initialize_data=false`.
- Resolve `inputs.ref` by checkout and `git rev-parse HEAD`; never deploy `github.sha` when a different ref was selected.
- Deploy only a full commit SHA with a successful `ci.yml` run.
- Use `environment: production` and concurrency group `petcare-production` with `cancel-in-progress: false`.
- Publish `ghcr.io/<owner>/server:<tag>`, `ghcr.io/<owner>/admin:<tag>`, and `ghcr.io/<owner>/website:<tag>` with independent `SERVER_IMAGE_TAG`, `ADMIN_IMAGE_TAG`, and `WEBSITE_IMAGE_TAG`.
- The first deployment must target `all`; a partial deployment without `/opt/petcare/.deploy-images.env` fails.
- Persist new image tags only after container readiness and all four public HTTPS smoke checks pass.
- Migrations are forward-only; application images may roll back, but the workflow must never claim a database migration rollback.
- Only ports `80` and `443` are public. PostgreSQL, Redis, Server, and Website have no host mapping; Admin `8986` and Website Gateway `8080` remain bound to `127.0.0.1` for server-local diagnostics.
- TLS is limited to TLS 1.2 and 1.3; 3DES is forbidden; HSTS is enabled without `includeSubDomains`.
- Never read, print, commit, or build any TLS private key, Miniapp upload key, Aliyun SMS AccessKey, backup credential, SSH key, or GHCR token into an image.

---

### Task 1: Make all local certificate and key material untrackable and private

**Files:**

- Modify: `.gitignore`
- Modify: `.dockerignore`
- Modify: `scripts/repository-policy.test.mjs`
- Move locally, keep ignored: the nine root certificate/key files listed below

**Interfaces:**

- Consumes: Git ignore rules and the current Windows workspace paths.
- Produces: ignored `certs/` and `.secrets/wechat/` directories with ACLs restricted to the current user and `SYSTEM`.

- [ ] **Step 1: Add a failing repository policy test without reading secret contents**

Extend `scripts/repository-policy.test.mjs` with path-only probes:

```javascript
test("部署证书、CSR 与上传密钥永远不进入 Git 或 Docker 上下文", () => {
  const probes = [
    "certs/petcare-home.com_bundle.crt",
    "certs/petcare-home.com_bundle.pem",
    "certs/petcare-home.com.csr",
    "certs/petcare-home.com.key",
    "certs/admin.petcare-home.com_bundle.crt",
    "certs/admin.petcare-home.com_bundle.pem",
    "certs/admin.petcare-home.com.csr",
    "certs/admin.petcare-home.com.key",
    ".secrets/wechat/private.wx3bdad4ab652f0d1d.key",
    ".deploy-images.env",
  ];
  const ignored = runGit(["check-ignore", "--verbose", "--stdin"], `${probes.join("\n")}\n`);

  assert.equal(ignored.status, 0, ignored.stderr);
  assert.equal(ignored.stdout.trim().split(/\r?\n/).length, probes.length);
});

test("Docker 构建上下文排除部署凭据目录", async () => {
  const dockerignore = await readFile(resolve(root, ".dockerignore"), "utf8");

  assert.match(dockerignore, /^certs\/$/m);
  assert.match(dockerignore, /^\.secrets\/$/m);
});
```

- [ ] **Step 2: Run the policy test and confirm it fails**

Run:

```bash
node --test scripts/repository-policy.test.mjs
```

Expected: FAIL because certificate and CSR paths are not comprehensively ignored.

- [ ] **Step 3: Add narrow repository and build-context ignore rules**

Add to both `.gitignore` and `.dockerignore`:

```gitignore
# Deployment certificates and local credentials
certs/
.secrets/
.deploy-images.env
*.crt
*.csr
*.cer
*.p7b
*.p7c
```

Retain the existing `*.pem`, `*.key`, `*.p12`, and `*.pfx` rules. Certificate bundles are public in isolation, but ignoring the complete material set prevents accidental partial publication and keeps one predictable secret boundary.

- [ ] **Step 4: Move the existing files without displaying their contents**

Resolve and verify both destination directories remain under `D:\projects\petcare`, then run only literal-path moves:

```powershell
$workspace = (Resolve-Path -LiteralPath "D:\projects\petcare").Path
$certDir = Join-Path $workspace "certs"
$wechatDir = Join-Path $workspace ".secrets\wechat"
New-Item -ItemType Directory -Force -Path $certDir, $wechatDir | Out-Null

Move-Item -LiteralPath "D:\projects\petcare\petcare-home.com_bundle.crt" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\petcare-home.com_bundle.pem" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\petcare-home.com.csr" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\petcare-home.com.key" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\admin.petcare-home.com_bundle.crt" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\admin.petcare-home.com_bundle.pem" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\admin.petcare-home.com.csr" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\admin.petcare-home.com.key" -Destination $certDir
Move-Item -LiteralPath "D:\projects\petcare\private.wx3bdad4ab652f0d1d.key" -Destination $wechatDir
```

Do not use a glob and do not open any moved file.

- [ ] **Step 5: Restrict Windows ACLs and verify path-only metadata**

```powershell
icacls "D:\projects\petcare\certs" /inheritance:r
icacls "D:\projects\petcare\certs" /grant:r "${env:USERNAME}:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "SYSTEM:(OI)(CI)F"
icacls "D:\projects\petcare\.secrets" /inheritance:r
icacls "D:\projects\petcare\.secrets" /grant:r "${env:USERNAME}:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "SYSTEM:(OI)(CI)F"
Get-ChildItem -LiteralPath $certDir, $wechatDir -File | Select-Object FullName, Length
git status --short
```

Expected: only filenames and sizes are displayed; no key or certificate appears in `git status`.

- [ ] **Step 6: Run ignore and diff verification**

```bash
node --test scripts/repository-policy.test.mjs
git check-ignore --verbose certs/petcare-home.com.key certs/admin.petcare-home.com_bundle.crt .secrets/wechat/private.wx3bdad4ab652f0d1d.key
git ls-files -ci --exclude-from=.gitignore
git diff --check
```

Expected: every probe is ignored from the root rules, no ignored path is tracked, and diff check passes.

- [ ] **Step 7: Commit only ignore policy, never the moved files**

```bash
git add .gitignore .dockerignore scripts/repository-policy.test.mjs
git commit -m "chore(security): 隔离部署证书与本地密钥"
```

---

### Task 2: Make Compose and Nginx enforce independent images and HTTPS-only ingress

**Files:**

- Modify: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Modify: `docker/edge-nginx.conf`
- Modify: `docker/nginx.conf`
- Modify: `docker/website-nginx.conf`
- Modify: `.env.example`
- Modify: `scripts/compose-policy.test.mjs`

**Interfaces:**

- Consumes: `IMAGE_REGISTRY`, `SERVER_IMAGE_TAG`, `ADMIN_IMAGE_TAG`, `WEBSITE_IMAGE_TAG`, and four fixed certificate filenames under `./certs`.
- Produces: internal application services plus the sole public `edge-gateway` on `80:80` and `443:443`.

- [ ] **Step 1: Replace old Compose policy assertions with failing production invariants**

Extend `scripts/compose-policy.test.mjs`:

```javascript
test("Compose 使用独立应用标签且只有边缘网关暴露公网端口", async () => {
  const compose = await readFile(resolve(root, "docker-compose.yml"), "utf8");

  assert.match(serviceBlock(compose, "server"), /server:\$\{SERVER_IMAGE_TAG:-local\}/);
  assert.match(serviceBlock(compose, "admin"), /admin:\$\{ADMIN_IMAGE_TAG:-local\}/);
  assert.match(serviceBlock(compose, "website"), /website:\$\{WEBSITE_IMAGE_TAG:-local\}/);
  assert.doesNotMatch(compose, /\$\{IMAGE_TAG/);

  for (const service of ["postgres", "redis", "server", "website"]) {
    assert.doesNotMatch(
      serviceBlock(compose, service),
      /^ {4}ports:/m,
      `${service} 不得映射宿主机端口`,
    );
  }

  assert.match(serviceBlock(compose, "admin"), /127\.0\.0\.1:8986:80/);
  assert.match(
    serviceBlock(compose, "website-gateway"),
    /127\.0\.0\.1:\$\{WEBSITE_PORT:-8080\}:80/,
  );
  const edge = serviceBlock(compose, "edge-gateway");
  assert.match(edge, /- "80:80"/);
  assert.match(edge, /- "443:443"/);
});

test("边缘网关禁用旧 TLS 并发送安全响应头", async () => {
  const nginx = await readFile(resolve(root, "docker/edge-nginx.conf"), "utf8");

  assert.match(nginx, /ssl_protocols TLSv1\.2 TLSv1\.3/);
  assert.doesNotMatch(nginx, /3DES|DES-CBC/);
  assert.match(nginx, /Strict-Transport-Security "max-age=31536000" always/);
  assert.doesNotMatch(nginx, /includeSubDomains/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$scheme/);
});

test("内部网关保留边缘传入的 HTTPS 协议", async () => {
  for (const path of ["docker/nginx.conf", "docker/website-nginx.conf"]) {
    const nginx = await readFile(resolve(root, path), "utf8");

    assert.match(nginx, /map \$http_x_forwarded_proto \$upstream_forwarded_proto/);
    assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$upstream_forwarded_proto/);
    assert.doesNotMatch(nginx, /proxy_set_header X-Forwarded-Proto \$scheme/);
  }
});

test("开发覆盖只把数据库和 Redis 绑定到本机回环", async () => {
  const override = await readFile(resolve(root, "docker-compose.dev.yml"), "utf8");

  assert.match(override, /127\.0\.0\.1:\$\{EXPOSE_DB_PORT:-5432\}:5432/);
  assert.match(override, /127\.0\.0\.1:\$\{EXPOSE_REDIS_PORT:-6379\}:6379/);
  assert.doesNotMatch(override, /(?:^|["'])0\.0\.0\.0:/m);
});
```

Keep these existing server-local diagnostic assertions in `Compose 将官网 SSR 保持在内部网络并仅传递所需运行变量`:

```javascript
assert.match(admin, /127\.0\.0\.1:8986:80/);
assert.match(gateway, /127\.0\.0\.1:\$\{WEBSITE_PORT:-8080\}:80/);
```

Retain `WEBSITE_PORT=8080` in that test's `.env.example` value table.

- [ ] **Step 2: Run Compose policy and confirm current failures**

Run:

```bash
node --test scripts/compose-policy.test.mjs
```

Expected: FAIL because Compose shares `IMAGE_TAG`, publishes database/cache ports through the base file, and Nginx still permits 3DES, lacks HSTS, and overwrites Edge's forwarded protocol.

- [ ] **Step 3: Give each application its own immutable image tag**

Use these exact image declarations:

```yaml
server:
  image: ${IMAGE_REGISTRY:-petcare}/server:${SERVER_IMAGE_TAG:-local}

admin:
  image: ${IMAGE_REGISTRY:-petcare}/admin:${ADMIN_IMAGE_TAG:-local}

website:
  image: ${IMAGE_REGISTRY:-petcare}/website:${WEBSITE_IMAGE_TAG:-local}
```

Remove the `ports` sections only from PostgreSQL and Redis. Server and Website already remain internal. Keep Admin at `127.0.0.1:8986:80` and Website Gateway at `127.0.0.1:${WEBSITE_PORT:-8080}:80` for local diagnostics. Keep `WEBSITE_PORT`, `EXPOSE_DB_PORT`, and `EXPOSE_REDIS_PORT` in `.env.example`; the latter two are used only by the development override.

Create `docker-compose.dev.yml`:

```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:${EXPOSE_DB_PORT:-5432}:5432"

  redis:
    ports:
      - "127.0.0.1:${EXPOSE_REDIS_PORT:-6379}:6379"
```

Local host development starts infrastructure with both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
```

Production uses only `docker-compose.yml`, so no database or Redis host port exists.

- [ ] **Step 4: Make runtime public URLs explicit Compose inputs**

Replace hard-coded Server public values with:

```yaml
API_BASE_URL: ${API_BASE_URL:?API_BASE_URL is required}
ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:?ALLOWED_ORIGINS is required}
WEBSITE_PUBLIC_URL: ${WEBSITE_PUBLIC_URL:?WEBSITE_PUBLIC_URL is required}
```

Keep `WEBSITE_CONTENT_API_BASE_URL=http://server:3000` internal. Production `.env` later sets HTTPS URLs; no certificate or private key becomes an environment value inside application containers.

- [ ] **Step 5: Harden the existing edge Nginx configuration**

Use:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
```

In both HTTPS server blocks add:

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

Keep the HTTP 301 redirect, map `petcare-home.com` and `www.petcare-home.com` to Website Gateway, map `admin.petcare-home.com` (including `/api`) to Admin, and change proxy forwarding to:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

At the top of both internal Nginx files add:

```nginx
map $http_x_forwarded_proto $upstream_forwarded_proto {
    default $http_x_forwarded_proto;
    "" $scheme;
}
```

In every proxy location in `docker/nginx.conf` and `docker/website-nginx.conf`, set:

```nginx
proxy_set_header X-Forwarded-Proto $upstream_forwarded_proto;
```

This preserves Edge's `https` value while falling back to the local scheme for direct loopback diagnostics.

- [ ] **Step 6: Run focused Compose and Nginx verification**

Run:

```bash
node --test scripts/compose-policy.test.mjs
docker compose --env-file .env config --quiet
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env config --quiet
docker run --rm --network none --add-host website-gateway:127.0.0.1 --add-host admin:127.0.0.1 -v "$PWD/docker/edge-nginx.conf:/etc/nginx/conf.d/default.conf:ro" -v "$PWD/certs:/etc/nginx/certs:ro" nginx:alpine nginx -t
docker run --rm --network none --add-host server:127.0.0.1 -v "$PWD/docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
docker run --rm --network none --add-host server:127.0.0.1 --add-host website:127.0.0.1 -v "$PWD/docker/website-nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t
git diff --check
```

Expected: policy and Compose checks pass. `nginx -t` passes using local certificate filenames but never outputs private key contents.

- [ ] **Step 7: Commit the HTTPS ingress contract**

```bash
git add docker-compose.yml docker-compose.dev.yml docker/edge-nginx.conf docker/nginx.conf docker/website-nginx.conf .env.example scripts/compose-policy.test.mjs
git commit -m "feat(deploy): 收敛 HTTPS 入口与独立镜像标签"
```

---

### Task 3: Implement one tested server-side release transaction

**Files:**

- Create: `scripts/release-production.sh`
- Create: `scripts/deploy-policy.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes environment values `TARGET`, `IMAGE_REGISTRY`, `RELEASE_SHA`, `NEW_IMAGE_TAG`, and `INITIALIZE_DATA`; consumes `.env`, `.deploy-images.env`, `scripts/database-backup.sh`, and Docker Compose.
- Produces: atomically updated `/opt/petcare/.deploy-images.env` containing `IMAGE_REGISTRY`, `SERVER_IMAGE_TAG`, `ADMIN_IMAGE_TAG`, and `WEBSITE_IMAGE_TAG` after successful deployment.

- [ ] **Step 1: Write failing deployment transaction policies**

Create `scripts/deploy-policy.test.mjs`:

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("生产发布按备份、迁移、就绪、HTTPS 验证、原子状态顺序执行", async () => {
  const script = await readFile(resolve(root, "scripts/release-production.sh"), "utf8");
  const backup = script.indexOf("scripts/database-backup.sh");
  const migrate = script.indexOf("prisma:migrate:deploy");
  const wait = script.indexOf("--wait-timeout 180");
  const smoke = script.indexOf("https://petcare-home.com");
  const persist = script.indexOf('mv -f -- "$CANDIDATE_STATE" "$STATE_FILE"');

  assert.ok(backup >= 0 && backup < migrate);
  assert.ok(migrate < wait && wait < smoke && smoke < persist);
  assert.match(script, /INITIALIZE_DATA.*true[\s\S]*TARGET.*all[\s\S]*prisma:seed/);
  assert.match(script, /首次部署必须选择 target=all/);
  assert.match(script, /http:\/\/petcare-home\.com/);
  assert.match(script, /HTTP\/[0-9.]+ 301/);
  assert.match(script, /trap .*ERR/);
  assert.doesNotMatch(script, /prisma:push|prisma db push/);
});

test("选择性发布刷新准确的依赖网关", async () => {
  const script = await readFile(resolve(root, "scripts/release-production.sh"), "utf8");

  assert.match(
    script,
    /server\)[\s\S]*?APP_SERVICES=\(server\)[\s\S]*?RESTART_SERVICES=\(admin website-gateway\)/,
  );
  assert.match(
    script,
    /admin\)[\s\S]*?APP_SERVICES=\(admin\)[\s\S]*?RESTART_SERVICES=\(edge-gateway\)/,
  );
  assert.match(
    script,
    /website\)[\s\S]*?APP_SERVICES=\(website\)[\s\S]*?RESTART_SERVICES=\(website-gateway\)/,
  );
  assert.match(script, /docker compose .* restart "\$\{RESTART_SERVICES\[@\]\}"/);
});
```

Add this file to the root `test:tooling` command.

- [ ] **Step 2: Run the policy and verify the release script is absent**

Run:

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL with `ENOENT` for `scripts/release-production.sh`.

- [ ] **Step 3: Add strict inputs, current-state loading, and candidate tags**

Start `scripts/release-production.sh` with:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET="${TARGET:?TARGET is required}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:?IMAGE_REGISTRY is required}"
RELEASE_SHA="${RELEASE_SHA:?RELEASE_SHA is required}"
NEW_IMAGE_TAG="${NEW_IMAGE_TAG:?NEW_IMAGE_TAG is required}"
INITIALIZE_DATA="${INITIALIZE_DATA:-false}"
INSTALL_DIR="/opt/petcare"
STATE_FILE="$INSTALL_DIR/.deploy-images.env"
CANDIDATE_STATE="$(mktemp "$INSTALL_DIR/.deploy-images.XXXXXX")"
HAD_STATE=false

[[ "$TARGET" =~ ^(all|server|admin|website)$ ]]
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$NEW_IMAGE_TAG" == "sha-$RELEASE_SHA" ]]
[[ "$INITIALIZE_DATA" == true || "$INITIALIZE_DATA" == false ]]
if [[ "$INITIALIZE_DATA" == true && "$TARGET" != all ]]; then
  echo "initialize_data=true 只允许 target=all" >&2
  exit 1
fi

cd "$INSTALL_DIR"
if [[ -f "$STATE_FILE" ]]; then
  HAD_STATE=true
  if grep -Ev '^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$' "$STATE_FILE" | grep -q .; then
    echo "镜像状态文件格式无效" >&2
    exit 1
  fi
  source "$STATE_FILE"
  : "${IMAGE_REGISTRY:?状态文件缺少 IMAGE_REGISTRY}"
  : "${SERVER_IMAGE_TAG:?状态文件缺少 SERVER_IMAGE_TAG}"
  : "${ADMIN_IMAGE_TAG:?状态文件缺少 ADMIN_IMAGE_TAG}"
  : "${WEBSITE_IMAGE_TAG:?状态文件缺少 WEBSITE_IMAGE_TAG}"
elif [[ "$TARGET" != all ]]; then
  echo "首次部署必须选择 target=all" >&2
  exit 1
else
  SERVER_IMAGE_TAG="$NEW_IMAGE_TAG"
  ADMIN_IMAGE_TAG="$NEW_IMAGE_TAG"
  WEBSITE_IMAGE_TAG="$NEW_IMAGE_TAG"
fi
```

Save old tag values for rollback, replace only the selected target tags with `NEW_IMAGE_TAG`, then write the four candidate lines with `printf '%s\n'` and mode `600`. Reject state lines outside these four names before `source` by matching the complete file against `^(IMAGE_REGISTRY|SERVER_IMAGE_TAG|ADMIN_IMAGE_TAG|WEBSITE_IMAGE_TAG)=[a-zA-Z0-9./:_-]+$`.

- [ ] **Step 4: Encode the exact service impact map and rollback trap**

Use one `case`:

```bash
case "$TARGET" in
  server)
    APP_SERVICES=(server)
    RESTART_SERVICES=(admin website-gateway)
    CHECK_SERVICES=(server admin website-gateway)
    ;;
  admin)
    APP_SERVICES=(admin)
    RESTART_SERVICES=(edge-gateway)
    CHECK_SERVICES=(admin edge-gateway)
    ;;
  website)
    APP_SERVICES=(website)
    RESTART_SERVICES=(website-gateway)
    CHECK_SERVICES=(website website-gateway)
    ;;
  all)
    APP_SERVICES=(server admin website)
    RESTART_SERVICES=(website-gateway edge-gateway)
    CHECK_SERVICES=(postgres redis server admin website website-gateway edge-gateway)
    ;;
esac
```

Add an `ERR` trap that, only when an old state exists, restores old exported tags, runs `docker compose --env-file .env up -d --no-build` for `APP_SERVICES` and `RESTART_SERVICES`, then explicitly restarts `RESTART_SERVICES`. It must print that application rollback was attempted and migrations were not rolled back. Always remove the candidate state on exit unless it became the persisted state.

- [ ] **Step 5: Implement deployment order and explicit initialization**

After exporting candidate tags:

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env pull "${APP_SERVICES[@]}"
docker compose --env-file .env up -d --no-build --wait --wait-timeout 180 postgres redis

if [[ "$TARGET" == all || "$TARGET" == server ]]; then
  APPLICATION_TABLES="$(docker compose --env-file .env exec -T postgres sh -lc \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('\''pg_catalog'\'', '\''information_schema'\'');"')"
  if [[ "$HAD_STATE" == false && "$APPLICATION_TABLES" == 0 ]]; then
    echo "首次部署确认数据库为空，跳过无历史意义的备份"
  else
    BACKUP_RUNNER_IMAGE="$IMAGE_REGISTRY/server:$SERVER_IMAGE_TAG" scripts/database-backup.sh
  fi
  docker compose --env-file .env run --rm --no-deps server \
    pnpm --filter @petcare/server prisma:migrate:deploy

  if [[ "$INITIALIZE_DATA" == true ]]; then
    docker compose --env-file .env run --rm --no-deps server \
      pnpm --filter @petcare/server prisma:seed
  fi
fi

docker compose --env-file .env up -d --no-build "${APP_SERVICES[@]}" "${RESTART_SERVICES[@]}"
docker compose --env-file .env restart "${RESTART_SERVICES[@]}"
docker compose --env-file .env up -d --no-build --wait --wait-timeout 180 "${CHECK_SERVICES[@]}"
```

The daily default remains `INITIALIZE_DATA=false`.

- [ ] **Step 6: Add public HTTPS smoke checks and atomic persistence**

Verify HTTP redirects without following them:

```bash
for host in petcare-home.com www.petcare-home.com admin.petcare-home.com; do
  headers="$(curl --silent --show-error --head --max-redirs 0 "http://$host/")"
  grep -Eq '^HTTP/[0-9.]+ 301' <<< "$headers"
  grep -Eiq "^location: https://$host/" <<< "$headers"
done
```

Then verify the four HTTPS endpoints:

```bash
for url in \
  https://petcare-home.com \
  https://www.petcare-home.com \
  https://admin.petcare-home.com \
  https://admin.petcare-home.com/api/ready
do
  curl --fail --silent --show-error --location \
    --proto '=https' --tlsv1.2 \
    --retry 6 --retry-all-errors --retry-delay 5 \
    --output /dev/null "$url"
done

mv -f -- "$CANDIDATE_STATE" "$STATE_FILE"
chmod 600 "$STATE_FILE"
trap - ERR
```

Persist the state only after all four requests succeed. A failed smoke check triggers application rollback and leaves the old state file unchanged.

- [ ] **Step 7: Run shell and policy checks**

Run:

```bash
bash -n scripts/release-production.sh
node --test scripts/deploy-policy.test.mjs scripts/database-operations-policy.test.mjs
pnpm lint:scripts
git diff --check
```

Expected: all commands exit 0. Do not run the production release script locally because its install directory and public smoke checks are intentionally production-bound.

- [ ] **Step 8: Commit the release transaction**

```bash
git update-index --add --chmod=+x scripts/release-production.sh
git add scripts/release-production.sh scripts/deploy-policy.test.mjs package.json
git commit -m "feat(deploy): 增加可回退的选择性发布事务"
```

---

### Task 4: Rebuild the manual deploy workflow around the resolved SHA and protected secrets

**Files:**

- Modify: `.github/workflows/deploy.yml`
- Modify: `scripts/deploy-policy.test.mjs`

**Interfaces:**

- Consumes: GitHub `production` Environment secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST_FINGERPRINT`, `GHCR_PULL_TOKEN`, four TLS Base64 values, and four backup COS values; variable `DEPLOY_PORT=22`.
- Produces: full-SHA GHCR images and one protected SSH deployment invocation of `scripts/release-production.sh`.

- [ ] **Step 1: Add failing workflow policy assertions**

Append to `scripts/deploy-policy.test.mjs`:

```javascript
test("手动部署解析输入 ref、检查 CI 并保护生产并发", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  assert.match(workflow, /ref: \$\{\{ inputs\.ref \}\}/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /actions\/workflows\/ci\.yml\/runs/);
  assert.match(workflow, /services='\["server","admin","website"\]'/);
  assert.match(workflow, /fromJSON\(needs\.resolve\.outputs\.services\)/);
  assert.match(
    workflow,
    /registry \}\}\/\$\{\{ matrix\.service \}\}:\$\{\{ needs\.resolve\.outputs\.image_tag \}\}/,
  );
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /group: petcare-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /prisma:push|sync_schema/);
});

test("部署工作流验证 SSH 与 TLS 后才上传临时凭据", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  for (const secret of [
    "DEPLOY_HOST_FINGERPRINT",
    "TLS_WEBSITE_CERT_B64",
    "TLS_WEBSITE_KEY_B64",
    "TLS_ADMIN_CERT_B64",
    "TLS_ADMIN_KEY_B64",
    "BACKUP_COS_SECRET_ID",
    "BACKUP_COS_SECRET_KEY",
    "BACKUP_COS_BUCKET",
    "BACKUP_COS_REGION",
  ]) {
    assert.match(workflow, new RegExp(`secrets\\.${secret}`));
  }
  assert.match(workflow, /ssh-keyscan/);
  assert.match(workflow, /ssh-keygen -lf/);
  assert.match(workflow, /openssl x509 -checkend/);
  assert.match(workflow, /openssl x509 .* -checkhost petcare-home\.com/);
  assert.match(workflow, /openssl x509 .* -checkhost www\.petcare-home\.com/);
  assert.match(workflow, /openssl x509 .* -checkhost admin\.petcare-home\.com/);
  assert.match(workflow, /install [^\n]*-m 600/);
  assert.match(workflow, /if: always\(\)/);
});
```

- [ ] **Step 2: Run deployment policies and verify the old workflow fails**

Run:

```bash
node --test scripts/deploy-policy.test.mjs
```

Expected: FAIL because the current workflow resolves/builds `github.sha`, has no CI gate or protected Environment, shares image tags, and writes no Base64 TLS/backup secret bundle.

- [ ] **Step 3: Define the exact manual input and concurrency contract**

Use:

```yaml
on:
  workflow_dispatch:
    inputs:
      ref:
        description: "要部署的分支、标签或 commit SHA"
        required: true
        default: "master"
      target:
        description: "部署范围"
        required: true
        type: choice
        default: "all"
        options: ["all", "server", "admin", "website"]
      initialize_data:
        description: "仅首次全量部署创建默认数据"
        required: false
        type: boolean
        default: false

concurrency:
  group: petcare-production
  cancel-in-progress: false
```

Set permissions to `contents: read`, `packages: write`, and `actions: read`.

- [ ] **Step 4: Resolve one immutable commit and CI success**

The `resolve` job checks out `inputs.ref` with full history and emits:

```bash
sha="$(git rev-parse HEAD)"
case "${{ inputs.target }}" in
  all) services='["server","admin","website"]' ;;
  server) services='["server"]' ;;
  admin) services='["admin"]' ;;
  website) services='["website"]' ;;
esac
echo "sha=$sha" >> "$GITHUB_OUTPUT"
echo "image_tag=sha-$sha" >> "$GITHUB_OUTPUT"
echo "services=$services" >> "$GITHUB_OUTPUT"
echo "registry=ghcr.io/${GITHUB_REPOSITORY_OWNER,,}" >> "$GITHUB_OUTPUT"
```

Then query the exact workflow and SHA:

```bash
count="$(gh api \
  "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$sha&status=completed&per_page=50" \
  --jq '[.workflow_runs[] | select(.conclusion == "success")] | length')"
[[ "$count" -gt 0 ]] || { echo "所选提交没有成功的持续集成记录" >&2; exit 1; }
```

Pass `GH_TOKEN: ${{ github.token }}`. This gate must run before any image is pushed.

- [ ] **Step 5: Build only selected immutable application images**

Use a JSON matrix from `needs.resolve.outputs.services`, checkout `needs.resolve.outputs.sha`, and publish:

```yaml
tags: ${{ needs.resolve.outputs.registry }}/${{ matrix.service }}:${{ needs.resolve.outputs.image_tag }}
```

Use `Dockerfile.${{ matrix.service }}`, `docker/build-push-action@v6`, and existing per-service GHA cache scopes.

- [ ] **Step 6: Decode and validate runner-side deployment material**

In the `deploy` job set `environment: production`. Create a `$RUNNER_TEMP/petcare-deploy-${GITHUB_RUN_ID}` directory with mode `700`, write the SSH key with mode `600`, and Base64-decode the four TLS secrets to the exact filenames:

Set stable job-level paths first:

```yaml
env:
  DEPLOY_TMP: ${{ runner.temp }}/petcare-deploy-${{ github.run_id }}
  DEPLOY_PORT: ${{ vars.DEPLOY_PORT || 22 }}
```

Map every required Secret to an environment variable and validate names without printing values:

```bash
for name in \
  DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_HOST_FINGERPRINT GHCR_PULL_TOKEN \
  TLS_WEBSITE_CERT_B64 TLS_WEBSITE_KEY_B64 TLS_ADMIN_CERT_B64 TLS_ADMIN_KEY_B64 \
  BACKUP_COS_SECRET_ID BACKUP_COS_SECRET_KEY BACKUP_COS_BUCKET BACKUP_COS_REGION
do
  [[ -n "${!name:-}" ]] || { echo "$name is required" >&2; exit 1; }
done
[[ "$DEPLOY_PORT" =~ ^[0-9]+$ && "$DEPLOY_PORT" -ge 1 && "$DEPLOY_PORT" -le 65535 ]] || {
  echo "DEPLOY_PORT must be between 1 and 65535" >&2
  exit 1
}
```

```text
petcare-home.com_bundle.crt
petcare-home.com.key
admin.petcare-home.com_bundle.crt
admin.petcare-home.com.key
```

Create the temporary files without shell tracing:

```bash
umask 077
install -d -m 700 "$DEPLOY_TMP"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$DEPLOY_TMP/deploy_key"
printf '%s' "$TLS_WEBSITE_CERT_B64" | base64 --decode > "$DEPLOY_TMP/petcare-home.com_bundle.crt"
printf '%s' "$TLS_WEBSITE_KEY_B64" | base64 --decode > "$DEPLOY_TMP/petcare-home.com.key"
printf '%s' "$TLS_ADMIN_CERT_B64" | base64 --decode > "$DEPLOY_TMP/admin.petcare-home.com_bundle.crt"
printf '%s' "$TLS_ADMIN_KEY_B64" | base64 --decode > "$DEPLOY_TMP/admin.petcare-home.com.key"
printf '%s' "$GHCR_PULL_TOKEN" > "$DEPLOY_TMP/ghcr.token"
{
  printf 'BACKUP_COS_SECRET_ID=%s\n' "$BACKUP_COS_SECRET_ID"
  printf 'BACKUP_COS_SECRET_KEY=%s\n' "$BACKUP_COS_SECRET_KEY"
  printf 'BACKUP_COS_BUCKET=%s\n' "$BACKUP_COS_BUCKET"
  printf 'BACKUP_COS_REGION=%s\n' "$BACKUP_COS_REGION"
} > "$DEPLOY_TMP/petcare-backup.env"
chmod 600 "$DEPLOY_TMP"/*
```

For each certificate/key pair run:

```bash
test -s "$cert" && test -s "$key"
openssl x509 -in "$cert" -noout -checkend 604800
cert_pub="$(openssl x509 -in "$cert" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum | cut -d' ' -f1)"
key_pub="$(openssl pkey -in "$key" -pubout -outform DER | sha256sum | cut -d' ' -f1)"
[[ "$cert_pub" == "$key_pub" ]]
```

Then verify every required SAN explicitly:

```bash
openssl x509 -in "$DEPLOY_TMP/petcare-home.com_bundle.crt" -noout -checkhost petcare-home.com
openssl x509 -in "$DEPLOY_TMP/petcare-home.com_bundle.crt" -noout -checkhost www.petcare-home.com
openssl x509 -in "$DEPLOY_TMP/admin.petcare-home.com_bundle.crt" -noout -checkhost admin.petcare-home.com
```

Write `/etc/petcare-backup.env` content into a runner temporary file using the four backup secrets; write `GHCR_PULL_TOKEN` into a separate mode-`600` temporary file. Never echo either file.

- [ ] **Step 7: Pin SSH host identity before SCP or SSH**

```bash
ssh-keyscan -p "$DEPLOY_PORT" "$DEPLOY_HOST" > "$DEPLOY_TMP/scanned_hosts"
: > "$DEPLOY_TMP/known_hosts"
while IFS= read -r host_key; do
  fingerprint="$(printf '%s\n' "$host_key" | ssh-keygen -lf - -E sha256 | awk '{print $2}')"
  if [[ "$fingerprint" == "$DEPLOY_HOST_FINGERPRINT" ]]; then
    printf '%s\n' "$host_key" >> "$DEPLOY_TMP/known_hosts"
  fi
done < "$DEPLOY_TMP/scanned_hosts"
test -s "$DEPLOY_TMP/known_hosts"
```

Every `scp` and `ssh` invocation must use `-o StrictHostKeyChecking=yes -o UserKnownHostsFile="$DEPLOY_TMP/known_hosts" -i "$DEPLOY_TMP/deploy_key" -p "$DEPLOY_PORT"` (use uppercase `-P` for `scp`).

- [ ] **Step 8: Atomically install secrets and invoke the release helper**

Upload all temporary material to one remote `/tmp/petcare-release-${GITHUB_RUN_ID}` directory. Over SSH:

```bash
sudo install -d -o root -g root -m 700 /opt/petcare/certs
sudo install -o root -g root -m 644 "$REMOTE_TMP/petcare-home.com_bundle.crt" /opt/petcare/certs/petcare-home.com_bundle.crt.new
sudo install -o root -g root -m 600 "$REMOTE_TMP/petcare-home.com.key" /opt/petcare/certs/petcare-home.com.key.new
sudo install -o root -g root -m 644 "$REMOTE_TMP/admin.petcare-home.com_bundle.crt" /opt/petcare/certs/admin.petcare-home.com_bundle.crt.new
sudo install -o root -g root -m 600 "$REMOTE_TMP/admin.petcare-home.com.key" /opt/petcare/certs/admin.petcare-home.com.key.new
sudo mv -f /opt/petcare/certs/petcare-home.com_bundle.crt.new /opt/petcare/certs/petcare-home.com_bundle.crt
sudo mv -f /opt/petcare/certs/petcare-home.com.key.new /opt/petcare/certs/petcare-home.com.key
sudo mv -f /opt/petcare/certs/admin.petcare-home.com_bundle.crt.new /opt/petcare/certs/admin.petcare-home.com_bundle.crt
sudo mv -f /opt/petcare/certs/admin.petcare-home.com.key.new /opt/petcare/certs/admin.petcare-home.com.key
sudo install -o root -g root -m 600 "$REMOTE_TMP/petcare-backup.env" /etc/petcare-backup.env.new
sudo mv -f /etc/petcare-backup.env.new /etc/petcare-backup.env

cd /opt/petcare
if sudo docker compose --env-file /opt/petcare/.env ps --status running -q edge-gateway | grep -q .; then
  sudo docker compose --env-file /opt/petcare/.env exec -T edge-gateway nginx -t
  sudo docker compose --env-file /opt/petcare/.env exec -T edge-gateway nginx -s reload
fi
```

Each file replacement is atomic, certificate/key equality was verified before upload, and the running gateway is reloaded only after all four final files are present. Log into GHCR from the uploaded token file, delete it immediately, fetch and detach-checkout the resolved SHA, refresh the checked-out deployment scripts and systemd units, then execute:

```bash
sudo chmod 0755 \
  /opt/petcare/scripts/release-production.sh \
  /opt/petcare/scripts/database-backup.sh \
  /opt/petcare/scripts/database-restore.sh
sudo install -m 0644 \
  /opt/petcare/deploy/systemd/petcare-backup.service \
  /etc/systemd/system/petcare-backup.service
sudo install -m 0644 \
  /opt/petcare/deploy/systemd/petcare-backup.timer \
  /etc/systemd/system/petcare-backup.timer
sudo systemctl daemon-reload
sudo env \
  TARGET="$TARGET" \
  IMAGE_REGISTRY="$IMAGE_REGISTRY" \
  RELEASE_SHA="$RELEASE_SHA" \
  NEW_IMAGE_TAG="$NEW_IMAGE_TAG" \
  INITIALIZE_DATA="$INITIALIZE_DATA" \
  bash /opt/petcare/scripts/release-production.sh
sudo systemctl enable --now petcare-backup.timer
```

Use a remote trap to remove the entire remote temporary directory on success or failure.

- [ ] **Step 9: Add unconditional runner cleanup and verify policies**

Add a final step:

```yaml
- name: 清理 runner 临时凭据
  if: always()
  run: rm -rf -- "$DEPLOY_TMP"
```

Run:

```bash
node --test scripts/deploy-policy.test.mjs
git diff --check
```

Expected: deployment policy passes and workflow text contains no private values or old `sync_schema` path.

- [ ] **Step 10: Commit the protected manual workflow**

```bash
git add .github/workflows/deploy.yml scripts/deploy-policy.test.mjs
git commit -m "feat(ci): 建立受保护的手动生产发布"
```

---

### Task 5: Make CI a valid prerequisite for every deployable artifact

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/ci-policy.test.mjs`
- Modify: `scripts/deploy-policy.test.mjs`

**Interfaces:**

- Consumes: the repository's existing quality, unit, build, E2E, and Docker jobs.
- Produces: manually runnable CI that builds all three deployable images, compiles `mp-weixin`, validates Compose, and action-lints all workflows.

- [ ] **Step 1: Add failing CI coverage assertions**

Extend `scripts/ci-policy.test.mjs`:

```javascript
test("CI 可手动触发并覆盖全部发布产物", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const dockerJob = workflow.slice(workflow.indexOf("\n  docker:"));

  assert.match(workflow, /^ {2}workflow_dispatch:$/m);
  assert.match(workflow, /build:mp-weixin/);
  assert.match(workflow, /rhysd\/actionlint:1\.7\.7/);
  assert.match(dockerJob, /docker compose build server admin website/);
  assert.match(dockerJob, /docker compose config --quiet/);
});
```

- [ ] **Step 2: Run CI policies and verify missing coverage**

Run:

```bash
node --test scripts/ci-policy.test.mjs scripts/deploy-policy.test.mjs
```

Expected: FAIL because CI has no manual trigger, does not build `mp-weixin` or Website's Docker image, and does not action-lint workflow syntax.

- [ ] **Step 3: Add the manual trigger and Miniapp compile check**

Add an empty `workflow_dispatch:` trigger. In the existing build job, after the root build, run:

```yaml
- name: 编译微信小程序
  env:
    WECHAT_APP_ID: wx3bdad4ab652f0d1d
  run: pnpm build:miniapp:mp-weixin
```

The AppID is public application metadata; no AppSecret or upload private key enters CI.

- [ ] **Step 4: Validate workflow syntax and all Docker artifacts**

Add to the quality job:

```yaml
- name: 校验 GitHub Actions 语法
  run: docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7
```

Change the Docker build command to:

```yaml
- run: docker compose build server admin website
```

Keep `docker compose config --quiet` before the build. Use this exact job condition while still requiring all preceding jobs:

```yaml
if: (github.event_name == 'push' && github.ref == 'refs/heads/master') || github.event_name == 'workflow_dispatch'
```

- [ ] **Step 5: Run scoped CI/tooling verification**

Run:

```bash
node --test scripts/ci-policy.test.mjs scripts/deploy-policy.test.mjs scripts/compose-policy.test.mjs
pnpm build:miniapp:mp-weixin
docker compose --env-file .env config --quiet
git diff --check
```

Expected: all local commands exit 0. Let the pushed CI run perform Linux actionlint and all three image builds; do not duplicate the full repository suite locally unless these shared CI files invalidate it.

- [ ] **Step 6: Commit the complete release gate**

```bash
git add .github/workflows/ci.yml scripts/ci-policy.test.mjs scripts/deploy-policy.test.mjs
git commit -m "ci: 覆盖全部生产发布产物"
```

---

### Task 6: Align server initialization and deployment documentation

**Files:**

- Modify: `scripts/server-init.sh`
- Delete: `scripts/deploy-to-server.sh`
- Modify: `docs/08-deployment/github-actions-deploy.md`
- Modify: `docs/08-deployment/deployment.md`
- Modify: `docs/environment-variables.md`
- Modify: `docker/README.md`
- Modify: `SECURITY-CHECKLIST.md`
- Modify: `README.md`
- Modify: `scripts/workspace-contract.test.mjs`
- Modify: `docs/superpowers/plans/2026-08-20-main-app-deploy-https.md`

**Interfaces:**

- Consumes: Tasks 1-5 and the backup plan's scripts/systemd units.
- Produces: one supported operator path: `server-init.sh` once, then `deploy.yml` and `miniapp-release.yml` from GitHub Actions.

- [ ] **Step 1: Update server initialization for final domains and ports**

Generate these production values in `/opt/petcare/.env`:

```dotenv
API_BASE_URL=https://admin.petcare-home.com/api
ALLOWED_ORIGINS=https://admin.petcare-home.com
WEBSITE_PUBLIC_URL=https://petcare-home.com
WEBSITE_CONTENT_API_BASE_URL=http://server:3000
WECHAT_APP_ID=wx3bdad4ab652f0d1d
WECHAT_APP_SECRET=
ALIYUN_SMS_ACCESS_KEY_ID=
ALIYUN_SMS_ACCESS_KEY_SECRET=
ALIYUN_SMS_SIGN_NAME=
ALIYUN_SMS_TEMPLATE_CODE=
```

Keep `WECHAT_APP_SECRET` and the four `ALIYUN_SMS_*` values empty for the operator to fill securely before the first deploy. Explain that the SMS signature/template must already be approved, the template variable is `code`, and the AccessKey belongs to a dedicated RAM user restricted to `dysms:SendSms`. The generated `/opt/petcare/.env` is root-owned with mode `600`; never print its values. Remove `SERVER_IP`, `EXPOSE_DB_PORT`, and `EXPOSE_REDIS_PORT` from the generated production configuration and keep `WEBSITE_PORT=8080` for server-local diagnostics; the former two remain only in `.env.example` for `docker-compose.dev.yml`. Create `/opt/petcare/certs` with mode `700`, ensure the release/backup scripts are mode `755`, install systemd units, and tell the operator to open only `22`, `80`, and `443`.

Update local development commands in `README.md`, `docker/README.md`, and `docs/08-deployment/deployment.md` to:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis
```

Replace the old single-file Compose startup string in `scripts/workspace-contract.test.mjs` with this exact command so documentation policy follows the new development override.

- [ ] **Step 2: Remove the obsolete tarball deployment path**

Delete `scripts/deploy-to-server.sh`. It builds on the production host, omits Admin, uses HTTP endpoints, rewrites `.env`, and runs no CI gate; retaining it would create a second unsafe supported path.

- [ ] **Step 3: Replace the GitHub Environment checklist with exact names**

Document `production` Environment secrets:

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_KEY
DEPLOY_HOST_FINGERPRINT
GHCR_PULL_USER
GHCR_PULL_TOKEN
TLS_WEBSITE_CERT_B64
TLS_WEBSITE_KEY_B64
TLS_ADMIN_CERT_B64
TLS_ADMIN_KEY_B64
BACKUP_COS_SECRET_ID
BACKUP_COS_SECRET_KEY
BACKUP_COS_BUCKET
BACKUP_COS_REGION
MP_UPLOAD_PRIVATE_KEY_B64
```

Document variable `DEPLOY_PORT=22`. Include these safe PowerShell commands, running and pasting one value at a time into the named GitHub secret:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\petcare-home.com_bundle.crt")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\petcare-home.com.key")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\admin.petcare-home.com_bundle.crt")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\certs\admin.petcare-home.com.key")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\projects\petcare\.secrets\wechat\private.wx3bdad4ab652f0d1d.key")) | Set-Clipboard
```

Warn users never to paste Base64 values into shell history, issues, logs, commits, or documentation and to clear the clipboard after each GitHub secret is saved.

- [ ] **Step 4: Document first and daily deployment behavior**

State:

```text
First deploy: target=all, initialize_data=true
Daily full deploy: target=all, initialize_data=false
Selective deploy: target=server|admin|website, initialize_data=false
```

Explain independent image tags, `/opt/petcare/.deploy-images.env`, pre-Server backup, forward-only migrations, application rollback, `docker compose --wait --wait-timeout 180`, and the four public HTTPS smoke checks.

- [ ] **Step 5: Document external control-plane prerequisites**

Require:

- DNS A/AAAA records for `petcare-home.com`, `www.petcare-home.com`, and `admin.petcare-home.com` to resolve to the server.
- Tencent Lighthouse firewall ingress only on 22, 80, and 443; SSH source restrictions when operationally possible.
- GitHub `production` Environment protection/required reviewers.
- A GHCR token restricted to `read:packages` and a dedicated, key-only deployment automation account with passwordless `sudo`. The current Docker and root-run release operations are root-equivalent; document that privilege honestly instead of presenting a brittle binary allowlist as least privilege. Keep the account out of the Docker group, protect the `production` Environment with required reviewers, and rotate the SSH key.
- Valid certificate bundles covering both Website hosts and the Admin host.

- [ ] **Step 6: Run documentation and repository hygiene checks**

Run:

```bash
bash -n scripts/server-init.sh scripts/release-production.sh scripts/database-backup.sh scripts/database-restore.sh
pnpm exec prettier --check README.md docker/README.md docs/08-deployment/github-actions-deploy.md docs/08-deployment/deployment.md docs/environment-variables.md SECURITY-CHECKLIST.md
rg -n "http://.*8986|http://.*8080|sync_schema|prisma:push|deploy-to-server" README.md docker/README.md docs/08-deployment docs/environment-variables.md scripts/server-init.sh
node --test scripts/repository-policy.test.mjs scripts/compose-policy.test.mjs scripts/deploy-policy.test.mjs scripts/database-operations-policy.test.mjs scripts/ci-policy.test.mjs scripts/workspace-contract.test.mjs
git diff --check
```

Expected: all checks pass. Any remaining local-only HTTP or `prisma:push` reference is explicitly scoped to disposable development; no obsolete production path remains.

- [ ] **Step 7: Commit the operator handoff**

```bash
git add scripts/server-init.sh scripts/deploy-to-server.sh README.md docker/README.md docs/08-deployment/github-actions-deploy.md docs/08-deployment/deployment.md docs/environment-variables.md SECURITY-CHECKLIST.md scripts/workspace-contract.test.mjs docs/superpowers/plans/2026-08-20-main-app-deploy-https.md
git commit -m "docs(deploy): 统一生产发布与 HTTPS 运维流程"
```
