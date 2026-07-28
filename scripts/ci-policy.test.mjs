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

  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /pnpm\/action-setup@v6/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /github\.event_name == 'push'.*refs\/heads\/master/);
  assert.doesNotMatch(workflow, /WECHAT_APP_SECRET|ALIYUN_OSS_ACCESS_KEY_SECRET/);
});

test("Dependabot 每周检查 pnpm、Docker 和 GitHub Actions", async () => {
  const dependabot = await readFile(resolve(root, ".github/dependabot.yml"), "utf8");

  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(dependabot, /package-ecosystem: docker/);
  assert.match(dependabot, /package-ecosystem: github-actions/);
  assert.equal((dependabot.match(/interval: weekly/g) ?? []).length, 3);
});
