import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const commitlintCli = resolve(root, "node_modules/@commitlint/cli/cli.js");

function lintCommit(message) {
  return spawnSync(process.execPath, [commitlintCli, "--color=false"], {
    cwd: root,
    encoding: "utf8",
    input: `${message}\n`,
  });
}

test("接受 Conventional Commits 中文主题", () => {
  assert.equal(lintCommit("fix(server): 修复启动配置校验").status, 0);
});

test("拒绝纯英文主题和非法 type", () => {
  assert.notEqual(lintCommit("fix: update server config").status, 0);
  assert.notEqual(lintCommit("change: 更新服务配置").status, 0);
});

test("Hooks 使用 pnpm exec，换行策略为 Windows 脚本保留 CRLF", async () => {
  const commitMsg = await readFile(resolve(root, ".husky/commit-msg"), "utf8");
  const preCommit = await readFile(resolve(root, ".husky/pre-commit"), "utf8");
  const commitCheck = await readFile(resolve(root, "scripts/commit-check.mjs"), "utf8");
  const attributes = await readFile(resolve(root, ".gitattributes"), "utf8");
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const lintStaged = JSON.stringify(manifest["lint-staged"]);

  assert.match(commitMsg, /corepack pnpm exec commitlint --edit/);
  assert.match(preCommit, /corepack pnpm exec lint-staged/);
  assert.match(preCommit, /corepack pnpm run commit:check/);
  assert.doesNotMatch(preCommit, /\b(?:pnpm|corepack pnpm)\s+(?:run\s+)?(?:build|check)\b/);
  assert.match(commitCheck, /--noEmit/);
  assert.match(commitCheck, /\["lint"\]/);
  assert.match(commitCheck, /\["test:e2e"\]/);
  assert.doesNotMatch(commitCheck, /\b(?:pnpm|corepack pnpm)\s+(?:run\s+)?build\b/);
  assert.equal(manifest.scripts["lint:scripts"], "node node_modules/eslint/bin/eslint.js scripts");
  assert.doesNotMatch(`${commitMsg}\n${preCommit}`, /\bnpx\b/);
  assert.doesNotMatch(lintStaged, /(?<!corepack )pnpm --filter/);
  assert.doesNotMatch(lintStaged, /(?:vitest|jest)\s+run/);
  assert.match(attributes, /^\*\.bat text eol=crlf$/m);
  assert.match(attributes, /^\*\.cmd text eol=crlf$/m);
});
