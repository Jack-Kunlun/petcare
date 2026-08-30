import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

const assertMiniappUploadBoundary = (workflow) => {
  const topLevelPermissions = workflow.slice(
    workflow.indexOf("\npermissions:"),
    workflow.indexOf("\nconcurrency:"),
  );
  const uploadJob = workflow.slice(workflow.indexOf("\n  upload:"));
  const cleanupMarker = "      - name: 清理临时密钥";
  const cleanupStep = uploadJob.slice(uploadJob.indexOf(cleanupMarker));

  assert.equal(topLevelPermissions, "\npermissions:\n  contents: read\n");
  assert.doesNotMatch(uploadJob, /^\s+permissions\s*:/m);
  assert.match(
    uploadJob,
    /^ {10}printf '%s' "\$MP_UPLOAD_PRIVATE_KEY_B64" \| base64 --decode > "\$MINIAPP_TMP\/private\.key"$/m,
  );
  assert.equal(
    cleanupStep.trimEnd(),
    `${cleanupMarker}\n        if: always()\n        shell: bash\n        run: rm -rf -- "$MINIAPP_TMP"`,
  );
};

const assertMiniappArtifactIdentity = (uploadJob) => {
  const buildMarker = "      - name: 构建小程序（mp-weixin）";
  const identityMarker = "      - name: 校验构建产物 AppID";
  const secretDecodeMarker = "      - name: 解码临时上传密钥";
  const identityStart = uploadJob.indexOf(identityMarker);
  const identityEnd = uploadJob.indexOf("\n      - name:", identityStart + identityMarker.length);
  const identityStep = uploadJob.slice(identityStart, identityEnd === -1 ? undefined : identityEnd);

  assert.ok(
    uploadJob.indexOf(buildMarker) < identityStart,
    "构建产物 AppID 校验必须在 mp-weixin 构建后执行",
  );
  assert.ok(
    identityStart < uploadJob.indexOf(secretDecodeMarker),
    "构建产物 AppID 校验必须在解码上传密钥前执行",
  );
  assert.match(uploadJob, /^ {6}WECHAT_APP_ID: wx3bdad4ab652f0d1d$/m);
  assert.match(identityStep, /node --input-type=module <<'NODE'/);
  assert.match(
    identityStep,
    /readFile\("apps\/miniapp\/dist\/build\/mp-weixin\/project\.config\.json", "utf8"\)/,
  );
  assert.match(identityStep, /JSON\.parse/);
  assert.match(identityStep, /config\.appid !== process\.env\.WECHAT_APP_ID/);
  assert.match(identityStep, /throw new Error/);
};

test("CI 提供分层质量门禁并使用当前稳定 Actions 主版本", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");

  for (const job of ["quality", "unit-test", "build", "e2e", "docker"]) {
    assert.match(workflow, new RegExp(`^  ${job}:`, "m"), `缺少 ${job} Job`);
  }

  assert.match(workflow, /^ {2}NODE_VERSION: "24\.19\.0"$/m);
  assert.doesNotMatch(workflow, /PNPM_VERSION/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v6/);
  assert.match(workflow, /pnpm\/action-setup@v6/);
  assert.doesNotMatch(workflow, /pnpm\/action-setup@v6\s*\n\s+with:\s*\n\s+version:/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /github\.event_name == 'push'.*refs\/heads\/master/);
  assert.doesNotMatch(workflow, /WECHAT_APP_SECRET|ALIYUN_OSS_ACCESS_KEY_SECRET/);
});

test("CI 在执行数据库 seed 前构建共享类型", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const e2eJob = workflow.slice(workflow.indexOf("\n  e2e:"), workflow.indexOf("\n  docker:"));
  const sharedTypesBuild = e2eJob.indexOf("run: pnpm --filter @petcare/shared-types build");
  const serverSeed = e2eJob.indexOf("run: pnpm --filter @petcare/server prisma:seed");

  assert.notEqual(sharedTypesBuild, -1, "E2E Job 缺少共享类型构建步骤");
  assert.notEqual(serverSeed, -1, "E2E Job 缺少数据库 seed 步骤");
  assert.ok(sharedTypesBuild < serverSeed, "共享类型必须在数据库 seed 前完成构建");
});

test("CI initializes PostgreSQL through committed migrations", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const e2eJob = workflow.slice(workflow.indexOf("\n  e2e:"), workflow.indexOf("\n  docker:"));
  const deployCommand = "pnpm --filter @petcare/server prisma:migrate:deploy";
  const firstDeploy = e2eJob.indexOf(deployCommand);
  const secondDeploy = e2eJob.indexOf(deployCommand, firstDeploy + deployCommand.length);
  const migrationStatus = e2eJob.indexOf("pnpm --filter @petcare/server prisma:migrate:status");
  const serverSeed = e2eJob.indexOf("pnpm --filter @petcare/server prisma:seed");

  assert.notEqual(firstDeploy, -1, "E2E Job 缺少首次迁移部署步骤");
  assert.notEqual(secondDeploy, -1, "E2E Job 必须重复执行迁移部署步骤");
  assert.notEqual(migrationStatus, -1, "E2E Job 缺少迁移状态检查步骤");
  assert.ok(firstDeploy < secondDeploy, "迁移部署必须重复执行");
  assert.ok(secondDeploy < migrationStatus, "迁移状态检查必须在重复部署后执行");
  assert.ok(migrationStatus < serverSeed, "迁移状态检查必须在数据库 seed 前执行");
  assert.doesNotMatch(e2eJob, /prisma:push|prisma db push/);
});

test("CI 拒绝主线和 PR 分支中的 merge commit", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /name: 校验线性历史/u);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha/u);
  assert.match(workflow, /git rev-list --min-parents=2/u);
  assert.match(workflow, /printf '%s\\n' "\$merge_commits"/u);
});

test("CI 串行执行各工作区测试以适配 GitHub runner 资源限制", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const unitTestJob = workflow.slice(
    workflow.indexOf("\n  unit-test:"),
    workflow.indexOf("\n  build:"),
  );

  assert.equal(
    packageJson.scripts["test:ci"],
    "pnpm test:tooling && turbo run test --concurrency=1",
  );
  assert.match(unitTestJob, /- run: pnpm test:ci/u);
});

test("CI 通过根级 Turbo 命令覆盖 Website 的测试与构建", async () => {
  const [workflow, websitePackage] = await Promise.all([
    readFile(resolve(root, ".github/workflows/ci.yml"), "utf8"),
    readFile(resolve(root, "apps/website/package.json"), "utf8"),
  ]);
  const manifest = JSON.parse(websitePackage);
  const unitTestJob = workflow.slice(
    workflow.indexOf("\n  unit-test:"),
    workflow.indexOf("\n  build:"),
  );
  const buildJob = workflow.slice(workflow.indexOf("\n  build:"), workflow.indexOf("\n  e2e:"));

  assert.equal(manifest.scripts.test, "vitest run");
  assert.equal(manifest.scripts.build, "astro build");
  assert.match(unitTestJob, /- run: pnpm test:ci/u);
  assert.match(buildJob, /- run: pnpm build/u);
});

test("仓库不再配置 Dependabot 版本更新 PR", async () => {
  await assert.rejects(readFile(resolve(root, ".github/dependabot.yml"), "utf8"), {
    code: "ENOENT",
  });
});

test("CI 可手动触发并覆盖全部发布产物", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const dockerJob = workflow.slice(workflow.indexOf("\n  docker:"));

  assert.match(workflow, /^ {2}workflow_dispatch:$/m);
  assert.match(workflow, /pnpm build:miniapp:mp-weixin/);
  assert.match(workflow, /rhysd\/actionlint:1\.7\.7/);
  assert.match(dockerJob, /docker compose build server admin website/);
  assert.match(dockerJob, /docker compose config --quiet/);
  assert.match(
    dockerJob,
    /github\.event_name == 'push'.*github\.ref == 'refs\/heads\/master'.*github\.event_name == 'workflow_dispatch'/,
  );
  for (const name of ["API_BASE_URL", "ALLOWED_ORIGINS", "WEBSITE_PUBLIC_URL"]) {
    assert.match(dockerJob, new RegExp(`^ {6}${name}: https://`, "m"));
  }
  assert.doesNotMatch(workflow, /WECHAT_APP_SECRET|MP_UPLOAD_PRIVATE_KEY/);
});

test("手动小程序上传受 CI、环境和临时密钥策略保护", async () => {
  const [workflow, miniappPackageSource] = await Promise.all([
    readFile(resolve(root, ".github/workflows/miniapp-release.yml"), "utf8"),
    readFile(resolve(root, "apps/miniapp/package.json"), "utf8"),
  ]);
  const miniappPackage = JSON.parse(miniappPackageSource);
  const resolveJob = workflow.slice(
    workflow.indexOf("\n  resolve:"),
    workflow.indexOf("\n  upload:"),
  );
  const uploadJob = workflow.slice(workflow.indexOf("\n  upload:"));
  const sharedTypesBuild = uploadJob.indexOf("pnpm --filter @petcare/shared-types build");
  const miniappBuild = uploadJob.indexOf("pnpm build:miniapp:mp-weixin");

  assert.equal(miniappPackage.devDependencies["miniprogram-ci"], "2.1.31");
  assertMiniappUploadBoundary(workflow);
  assertMiniappArtifactIdentity(uploadJob);
  assert.match(workflow, /^ {6}ref:$/m);
  assert.match(workflow, /^ {6}version:$/m);
  assert.match(workflow, /^ {6}desc:$/m);
  assert.match(workflow, /ref: \$\{\{ inputs\.ref \}\}/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(resolveJob, /permissions:\n {6}contents: read\n {6}actions: read/);
  assert.match(resolveJob, /actions\/workflows\/ci\.yml\/runs\?head_sha=\$sha&status=completed/);
  assert.match(resolveJob, /select\(\.conclusion == "success"\)/);
  assert.match(uploadJob, /environment: production/);
  assert.match(workflow, /group: petcare-miniapp-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(uploadJob, /ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}/);
  assert.notEqual(sharedTypesBuild, -1, "小程序上传 Job 缺少共享类型构建步骤");
  assert.ok(sharedTypesBuild < miniappBuild, "共享类型必须在 mp-weixin 构建前完成构建");
  assert.match(
    uploadJob,
    /MP_UPLOAD_PRIVATE_KEY_B64: \$\{\{ secrets\.MP_UPLOAD_PRIVATE_KEY_B64 \}\}/,
  );
  assert.equal(workflow.match(/secrets\.MP_UPLOAD_PRIVATE_KEY_B64/g)?.length, 1);
  assert.doesNotMatch(uploadJob, /^ {6}MINIAPP_TMP:/m);
  assert.match(
    uploadJob,
    /printf 'MINIAPP_TMP=%s\\n' "\$RUNNER_TEMP\/petcare-miniapp-\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT" >> "\$GITHUB_ENV"/,
  );
  assert.match(uploadJob, /install -d -m 700 "\$MINIAPP_TMP"/);
  assert.match(uploadJob, /chmod 600 "\$MINIAPP_TMP\/private\.key"/);
  assert.match(uploadJob, /test -s apps\/miniapp\/dist\/build\/mp-weixin\/app\.json/);
  assert.match(uploadJob, /test -s apps\/miniapp\/dist\/build\/mp-weixin\/project\.config\.json/);
  assert.match(uploadJob, /pnpm --dir apps\/miniapp exec miniprogram-ci upload/);
  assert.match(uploadJob, /--pp dist\/build\/mp-weixin/);
  assert.match(uploadJob, /--upload-description "\$MP_DESC"/);
  assert.match(uploadJob, /--use-project-config true/);
  assert.doesNotMatch(workflow, /npx|@latest|MP_UPLOAD_PRIVATE_KEY(?!_B64)|WECHAT_APP_SECRET/);
});

test("小程序上传策略拒绝权限扩张、密钥跨 Job 和宽泛清理", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/miniapp-release.yml"), "utf8");
  const decodeLine =
    '          printf \'%s\' "$MP_UPLOAD_PRIVATE_KEY_B64" | base64 --decode > "$MINIAPP_TMP/private.key"';
  const mutations = [
    workflow.replace("permissions:\n  contents: read", "permissions: read-all"),
    workflow
      .replace(decodeLine, "          echo decode-moved")
      .replace("\n  upload:", `\n${decodeLine}\n  upload:`),
    workflow.replace(
      'run: rm -rf -- "$MINIAPP_TMP"',
      'run: rm -rf -- "$MINIAPP_TMP" /tmp/also-delete',
    ),
  ];

  for (const mutation of mutations) {
    assert.throws(() => assertMiniappUploadBoundary(mutation));
  }
});

test("小程序上传策略拒绝缺失构建产物 AppID 身份校验", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/miniapp-release.yml"), "utf8");
  const uploadJob = workflow.slice(workflow.indexOf("\n  upload:"));
  const withoutIdentityCheck = uploadJob.replace(
    "      - name: 校验构建产物 AppID",
    "      - name: 已移除构建产物 AppID 校验",
  );

  assert.throws(() => assertMiniappArtifactIdentity(withoutIdentityCheck));
});
