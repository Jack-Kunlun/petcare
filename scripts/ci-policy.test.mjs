import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("CI 提供分层质量门禁并使用当前稳定 Actions 主版本", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");

  for (const job of ["quality", "unit-test", "build", "e2e", "docker"]) {
    assert.match(workflow, new RegExp(`^  ${job}:`, "m"), `缺少 ${job} Job`);
  }

  assert.match(workflow, /^  NODE_VERSION: "24\.19\.0"$/m);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v6/);
  assert.match(workflow, /pnpm\/action-setup@v6/);
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

test("Dependabot 每周检查 pnpm、Docker 和 GitHub Actions", async () => {
  const dependabot = await readFile(resolve(root, ".github/dependabot.yml"), "utf8");

  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: docker/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.equal((dependabot.match(/interval: weekly/g) ?? []).length, 3);
});
