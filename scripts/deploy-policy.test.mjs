import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function position(script, fragment) {
  const index = script.indexOf(fragment);

  assert.notEqual(index, -1, "Expected release script to contain: " + fragment);

  return index;
}

function lastPosition(script, fragment) {
  const index = script.lastIndexOf(fragment);

  assert.notEqual(index, -1, "Expected release script to contain: " + fragment);

  return index;
}

function workflowJobBlock(workflow, name) {
  const start = new RegExp(`^  ${name}:\\r?$`, "m").exec(workflow)?.index;

  assert.notEqual(start, undefined, `Expected deploy workflow to contain ${name} job`);

  const nextJob = /\r?\n {2}[a-z][\w-]*:\r?\n/g;

  nextJob.lastIndex = start + `  ${name}:`.length;
  const end = nextJob.exec(workflow)?.index;

  return workflow.slice(start, end);
}

test("生产发布只在完整验证后原子保存可回退的镜像状态", async () => {
  const [script, packageJsonText] = await Promise.all([
    readFile(resolve(root, "scripts/release-production.sh"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  assert.match(script, /^set -Eeuo pipefail$/m);
  assert.match(script, /^umask 077$/m);
  assert.match(script, /^ROOT_DIR="\/opt\/petcare"$/m);
  assert.match(script, /^RELEASE_DIR="\$ROOT_DIR\/current"$/m);
  assert.match(script, /^ENV_FILE="\$ROOT_DIR\/\.env"$/m);
  assert.match(script, /^STATE_FILE="\$ROOT_DIR\/\.deploy-images\.env"$/m);
  assert.match(script, /^cd "\$RELEASE_DIR"$/m);
  assert.match(script, /docker compose --env-file "\$ENV_FILE"/);
  assert.match(
    script,
    /^STATE_KEYS=\(IMAGE_REGISTRY SERVER_IMAGE_TAG ADMIN_IMAGE_TAG WEBSITE_IMAGE_TAG\)$/m,
  );
  assert.match(script, /^INFRA_SERVICES=\(postgres redis website-gateway edge-gateway\)$/m);
  assert.match(script, /parse_state_file\(\) \{/);
  assert.match(script, /local -A seen=\(\)/);
  assert.match(script, /for key in "\$\{STATE_KEYS\[@\]\}"; do/);
  assert.match(script, /状态文件键重复/);
  assert.match(script, /状态文件缺少键/);
  assert.doesNotMatch(script, /(?:^|\n)\s*(?:source|\.)\s+.*deploy-images\.env/m);
  assert.doesNotMatch(script, /\beval\b/);
  assert.doesNotMatch(script, /grep[^\n]*\|\s*grep\b/);

  assert.match(script, /首次部署必须选择 target=all/);
  assert.match(script, /TARGET.*!= all[\s\S]*IMAGE_REGISTRY.*!=.*OLD_IMAGE_REGISTRY/);
  assert.match(
    script,
    /all\)[\s\S]*SERVER_IMAGE_TAG="\$NEW_IMAGE_TAG"[\s\S]*ADMIN_IMAGE_TAG="\$NEW_IMAGE_TAG"[\s\S]*WEBSITE_IMAGE_TAG="\$NEW_IMAGE_TAG"/,
  );
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
  assert.match(
    script,
    /HAD_STATE" == false[\s\S]*TARGET" == all[\s\S]*pull "\$\{INFRA_SERVICES\[@\]\}"/,
  );

  const cleanup = position(script, "trap cleanup EXIT");
  const candidate = position(
    script,
    'CANDIDATE_STATE="$(mktemp "$ROOT_DIR/.deploy-images.XXXXXX")"',
  );
  const candidateMode = position(script, 'chmod 600 "$CANDIDATE_STATE"');
  const initializeGuard = position(
    script,
    'if [[ "$INITIALIZE_DATA" == true && ( "$HAD_STATE" != false || "$APPLICATION_TABLES" != 0 ) ]]; then',
  );
  const backup = position(script, '"$RELEASE_DIR/scripts/database-backup.sh"');
  const migrate = position(script, "prisma:migrate:deploy");
  const wait = lastPosition(script, "--wait-timeout 180");
  const httpSmoke = position(script, "http://$host/");
  const httpsSmoke = position(script, "https://petcare-home.com");
  const persist = position(script, 'mv -f -- "$CANDIDATE_STATE" "$STATE_FILE"');

  assert.ok(cleanup < candidate && candidate < candidateMode);
  assert.ok(
    initializeGuard < backup &&
      backup < migrate &&
      migrate < wait &&
      wait < httpSmoke &&
      httpSmoke < httpsSmoke &&
      httpsSmoke < persist,
  );
  assert.match(script, /local status=\$\?/);
  assert.match(script, /rm -f -- "\$CANDIDATE_STATE"/);
  assert.match(
    script,
    /HAD_STATE.*false[\s\S]*APPLICATION_TABLES.*== 0[\s\S]*跳过无历史意义的备份/,
  );
  assert.match(script, /initialize_data=true 仅允许首次空库部署/);
  assert.match(
    script,
    /BACKUP_RUNNER_IMAGE="\$IMAGE_REGISTRY\/server:\$SERVER_IMAGE_TAG" \\\n\s+"\$RELEASE_DIR\/scripts\/database-backup\.sh"/,
  );
  assert.match(script, /INITIALIZE_DATA.*true[\s\S]*TARGET.*all[\s\S]*prisma:seed/);
  assert.doesNotMatch(script, /prisma:push|prisma db push/);

  assert.match(script, /trap on_error ERR/);
  assert.match(script, /ROLLBACK_RUNNING/);
  assert.match(script, /trap - ERR/);
  assert.match(script, /应用镜像回滚已尝试；数据库 migration 未回滚/);
  assert.match(
    script,
    /for host in petcare-home\.com www\.petcare-home\.com admin\.petcare-home\.com; do/,
  );
  assert.match(
    script,
    /redirect="\$\(curl --silent --show-error --head --max-redirs 0 --proto '=http' --connect-timeout 10 --max-time 30 --output \/dev\/null --write-out '%\{http_code\} %\{redirect_url\}' "http:\/\/\$host\/"\)"/,
  );
  assert.match(script, /\[\[ "\$redirect" == "301 https:\/\/\$host\/" \]\]/);
  assert.doesNotMatch(script, /headers="\$\(curl/);
  assert.doesNotMatch(script, /grep -Eq '\^HTTP/);
  assert.doesNotMatch(script, /grep -Eiq "\^location:/);
  for (const url of [
    "https://petcare-home.com",
    "https://www.petcare-home.com",
    "https://admin.petcare-home.com",
    "https://admin.petcare-home.com/api/ready",
  ]) {
    assert.ok(script.includes(url));
  }
  assert.match(script, /--proto '=https' --tlsv1\.2[\s\S]*--connect-timeout 10 --max-time 30/);
  assert.match(packageJson.scripts["test:tooling"], /\bscripts\/deploy-policy\.test\.mjs\b/);
});

test("后端运行镜像在构建时预热 pnpm，生产 migration 不依赖 npm 网络", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.server"), "utf8");
  const runnerStage = dockerfile.slice(
    position(dockerfile, "FROM node:24.19-alpine AS server-runner"),
  );
  const packageJson = position(runnerStage, "COPY --from=server-builder /app/package.json ./");
  const pnpmWarmup = position(runnerStage, "RUN corepack enable && pnpm --version");

  assert.ok(packageJson < pnpmWarmup);
});

test("后端运行镜像包含 seed 所需的 shared-types 构建产物", async () => {
  const dockerfile = await readFile(resolve(root, "Dockerfile.server"), "utf8");
  const runnerStage = dockerfile.slice(
    position(dockerfile, "FROM node:24.19-alpine AS server-runner"),
  );

  assert.match(
    runnerStage,
    /COPY --from=server-builder \/app\/packages\/shared-types\/dist \.\/packages\/shared-types\/dist/,
  );
});

test("手动部署只发布已通过 CI 的不可变所选镜像", async () => {
  const [workflow, ciWorkflow] = await Promise.all([
    readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8"),
    readFile(resolve(root, ".github/workflows/ci.yml"), "utf8"),
  ]);

  assert.match(ciWorkflow, /^ {2}workflow_dispatch:$/m);
  assert.match(workflow, /ref: \$\{\{ inputs\.ref \}\}/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /sha="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /actions\/workflows\/ci\.yml\/runs\?head_sha=\$sha&status=completed/);
  assert.match(workflow, /select\(\.conclusion == "success"\)/);
  assert.match(workflow, /services='\["server","admin","website"\]'/);
  assert.match(workflow, /fromJSON\(needs\.resolve\.outputs\.services\)/);
  assert.match(workflow, /ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}/);
  assert.match(
    workflow,
    /registry \}\}\/\$\{\{ matrix\.service \}\}:\$\{\{ needs\.resolve\.outputs\.image_tag \}\}/,
  );
  assert.match(workflow, /image_tag=sha-\$sha/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /sha-\$\{SHA::7\}/);
});

test("所选提交必须包含当前生产发布契约", async () => {
  const [workflow, releaseContract] = await Promise.all([
    readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8"),
    readFile(resolve(root, "deploy/production-release-contract"), "utf8"),
  ]);
  const resolveJob = workflowJobBlock(workflow, "resolve");
  const checkout = position(resolveJob, "ref: ${{ inputs.ref }}");
  const markerGate = position(
    resolveJob,
    "cmp -s <(printf '%s\\n' 'tcr-source-free-v1') deploy/production-release-contract",
  );
  const ciGate = position(resolveJob, "要求该提交的持续集成已成功");

  assert.equal(releaseContract, "tcr-source-free-v1\n");
  assert.doesNotMatch(resolveJob, /test "\$\(wc -l < deploy\/production-release-contract\)" -eq 1/);
  assert.doesNotMatch(
    resolveJob,
    /grep -Fxq "tcr-source-free-v1" deploy\/production-release-contract/,
  );
  assert.ok(checkout < markerGate && markerGate < ciGate);
});

test("部署工作流将 GitHub token 权限收敛到各 job", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");
  const resolveJob = workflowJobBlock(workflow, "resolve");
  const buildJob = workflowJobBlock(workflow, "build");
  const deployJob = workflowJobBlock(workflow, "deploy");

  assert.match(workflow, /^permissions:\r?\n {2}contents: read\r?\n\r?\nconcurrency:/m);
  assert.match(resolveJob, /^ {4}permissions:\r?\n {6}actions: read\r?\n {6}contents: read\r?$/m);
  assert.match(buildJob, /^ {4}permissions:\r?\n {6}contents: read\r?$/m);
  assert.doesNotMatch(buildJob, /packages: write/);
  assert.match(deployJob, /^ {4}permissions:\r?\n {6}contents: read\r?$/m);
  assert.doesNotMatch(deployJob, /github\.token/);
});

test("生产部署由专用 Linux runner 发起，构建仍使用 GitHub runner", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  for (const jobName of ["resolve", "build", "runtime-images"]) {
    assert.match(workflowJobBlock(workflow, jobName), /^ {4}runs-on: ubuntu-latest\r?$/m);
  }
  assert.match(
    workflowJobBlock(workflow, "deploy"),
    /^ {4}runs-on: \[self-hosted, linux, x64, petcare-deploy\]\r?$/m,
  );
});

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

test("生产部署先准备缺失的固定运行时镜像", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  for (const image of ["postgres:15-alpine", "redis:7-alpine", "nginx:alpine"]) {
    assert.ok(workflow.includes(image));
  }
  assert.match(workflow, /docker manifest inspect/);
  assert.match(workflow, /manifest unknown\|no such manifest\|not found/);
  assert.match(workflow, /needs: \[resolve, build, runtime-images\]/);
});

test("部署工作流先在受保护 runner 临时目录验证 SSH 与 TLS", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  assert.match(workflow, /environment: production/);
  assert.match(workflow, /group: petcare-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /^ {6}DEPLOY_TMP:/m);
  assert.match(
    workflow,
    /printf 'DEPLOY_TMP=%s\\n' "\$RUNNER_TEMP\/petcare-deploy-\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT" >> "\$GITHUB_ENV"/,
  );
  for (const secret of [
    "DEPLOY_HOST",
    "DEPLOY_USER",
    "DEPLOY_SSH_KEY",
    "DEPLOY_HOST_FINGERPRINT",
    "TCR_PULL_USERNAME",
    "TCR_PULL_PASSWORD",
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
  assert.match(workflow, /install -d -m 700 "\$DEPLOY_TMP"/);
  assert.match(workflow, /chmod 600 "\$DEPLOY_TMP"\/\*/);
  assert.match(workflow, /openssl x509 -in "\$cert" -noout -checkend 604800/);
  assert.match(workflow, /openssl x509 .* -checkhost petcare-home\.com/);
  assert.match(workflow, /openssl x509 .* -checkhost www\.petcare-home\.com/);
  assert.match(workflow, /openssl x509 .* -checkhost admin\.petcare-home\.com/);
  assert.match(workflow, /cert_pub=.*openssl x509[\s\S]*key_pub=.*openssl pkey/);
  assert.match(workflow, /ssh-keyscan -T 60 -4 -p "\$DEPLOY_PORT" "\$DEPLOY_HOST"/);
  assert.match(workflow, /ssh-keygen -lf - -E sha256/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /UserKnownHostsFile="\$DEPLOY_TMP\/known_hosts"/);
  assert.match(workflow, /TCR_PULL_USERNAME TCR_PULL_PASSWORD/);
  assert.match(workflow, /\[\[ "\$TCR_PULL_USERNAME" =~ \^\[a-zA-Z0-9\]/);
  assert.doesNotMatch(workflow, /REGISTRY_USER: \$\{\{ github\.repository_owner \}\}/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /appleboy\/ssh-action/);
  assert.doesNotMatch(workflow, /prisma:push|sync_schema/);
});

test("远端发布以 root 不可变 release 和临时凭据完成 TLS 与事务", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/deploy.yml"), "utf8");

  assert.match(
    workflow,
    /REMOTE_TMP="\/tmp\/petcare-release-\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT"/,
  );
  assert.match(workflow, /scp[\s\S]*StrictHostKeyChecking=yes[\s\S]*-P "\$DEPLOY_PORT"/);
  assert.match(workflow, /local status=\$\?/);
  assert.match(workflow, /sudo rm -rf -- "\$REMOTE_TMP"/);
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

  assert.match(workflow, /\/opt\/petcare\/current\/scripts\/release-production\.sh/);
  assert.match(workflow, /\/opt\/petcare\/current\/deploy\/systemd\/petcare-backup\.service/);
  assert.doesNotMatch(workflow, /\/opt\/petcare\/scripts\/release-production\.sh/);

  const remoteValidate = position(
    workflow,
    'validate_pair "/opt/petcare/certs/petcare-home.com_bundle.crt.new"',
  );
  const finalCert = position(
    workflow,
    'sudo mv -f -- "/opt/petcare/certs/petcare-home.com_bundle.crt.new"',
  );
  const reload = position(workflow, "nginx -s reload");
  assert.ok(remoteValidate < finalCert && finalCert < reload);
  assert.match(workflow, /checkhost petcare-home\.com/);
  assert.match(workflow, /checkhost www\.petcare-home\.com/);
  assert.match(workflow, /checkhost admin\.petcare-home\.com/);

  assert.match(workflow, /DOCKER_CONFIG="\$REMOTE_TMP\/docker-config"/);
  assert.match(workflow, /sudo env DOCKER_CONFIG="\$DOCKER_CONFIG" docker login/);
  assert.match(
    workflow,
    /docker login "\$TCR_REGISTRY"[\s\S]*-u "\$TCR_PULL_USERNAME" --password-stdin < "\$REMOTE_TMP\/tcr-pull\.password"/,
  );
  assert.match(workflow, /sudo rm -f -- "\$REMOTE_TMP\/tcr-pull\.password"/);
  assert.match(
    workflow,
    /DOCKER_CONFIG="\$DOCKER_CONFIG"[\s\S]*bash \/opt\/petcare\/current\/scripts\/release-production\.sh/,
  );
  assert.match(
    workflow,
    /install -m 0644[\s\S]*petcare-backup\.service[\s\S]*petcare-backup\.timer/,
  );
  assert.match(workflow, /systemctl daemon-reload/);
  const release = position(workflow, "bash /opt/petcare/current/scripts/release-production.sh");
  const releaseSucceeded = position(workflow, "RELEASE_SUCCEEDED=true");
  const enableTimer = position(workflow, "systemctl enable --now petcare-backup.timer");
  const preReleaseReload = workflow.slice(finalCert, release);
  assert.match(
    preReleaseReload,
    /docker inspect --format '\{\{\.State\.Running\}\}' petcare-edge-gateway/,
  );
  assert.match(preReleaseReload, /docker exec petcare-edge-gateway nginx -t/);
  assert.match(preReleaseReload, /docker exec petcare-edge-gateway nginx -s reload/);
  assert.doesNotMatch(preReleaseReload, /docker compose/);
  assert.doesNotMatch(preReleaseReload, /\|\s*grep -q/);
  assert.ok(release < releaseSucceeded && releaseSucceeded < enableTimer);
});

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

test("Miniapp 发布仍独立于 Docker、TCR 与生产服务器", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/miniapp-release.yml"), "utf8");

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /MP_UPLOAD_PRIVATE_KEY_B64/);
  assert.match(workflow, /build:miniapp:mp-weixin/);
  assert.match(workflow, /miniprogram-ci upload/);
  assert.doesNotMatch(workflow, /TCR_|ccr\.ccs\.tencentyun\.com|docker|ssh|scp/);
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

test("部署文档完整记录 TCR 配置和迁移后清理顺序", async () => {
  const paths = [
    "docs/08-deployment/deployment.md",
    "docs/08-deployment/github-actions-deploy.md",
    "docker/README.md",
    "SECURITY-CHECKLIST.md",
  ];
  const documentContents = await Promise.all(
    paths.map((path) => readFile(resolve(root, path), "utf8")),
  );
  const documents = documentContents.join("\n");

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
  for (const document of [documentContents[0], documentContents[1], documentContents[3]]) {
    assert.match(document, /验收后[\s\S]*\/root\/\.ssh\/petcare-readonly/);
    assert.match(document, /验收后[\s\S]*\/root\/\.ssh\/petcare-readonly\.pub/);
    assert.match(document, /验收后[\s\S]*\/root\/\.ssh\/known_hosts/);
    assert.match(document, /验收后[\s\S]*\/opt\/petcare\/\.git/);
  }
});
