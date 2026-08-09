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

function runGit(args, input) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
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
  const commitScope = await readFile(resolve(root, "scripts/commit-scope.mjs"), "utf8");
  const attributes = await readFile(resolve(root, ".gitattributes"), "utf8");
  const prettierIgnore = await readFile(resolve(root, ".prettierignore"), "utf8");
  const uniappEslint = await readFile(resolve(root, "apps/uniapp/eslint.config.mjs"), "utf8");
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const lintStaged = JSON.stringify(manifest["lint-staged"]);

  assert.match(commitMsg, /corepack pnpm exec commitlint --edit/);
  assert.match(preCommit, /corepack pnpm exec lint-staged/);
  assert.match(preCommit, /corepack pnpm run commit:check/);
  assert.doesNotMatch(preCommit, /\b(?:pnpm|corepack pnpm)\s+(?:run\s+)?(?:build|check)\b/);
  assert.match(commitCheck, /execFileSync\(/);
  assert.match(commitCheck, /"git"/);
  assert.match(commitCheck, /"--cached"/);
  assert.match(commitCheck, /"--name-only"/);
  assert.match(commitCheck, /"--diff-filter=ACMR"/);
  assert.match(commitCheck, /"-z"/);
  assert.match(commitCheck, /classifyStagedPaths/);
  assert.match(commitCheck, /createCommitCheckPlan/);
  assert.match(commitCheck, /createPnpmInvocation/);
  assert.doesNotMatch(commitCheck, /typescript\/bin\/tsc|--noEmit/);
  assert.match(commitScope, /"lint:styles"/);
  assert.doesNotMatch(commitCheck, /\["lint"\]/);
  assert.doesNotMatch(commitCheck, /\["test:e2e"\]/);
  assert.doesNotMatch(commitCheck, /\b(?:pnpm|corepack pnpm)\s+(?:run\s+)?build\b/);
  assert.equal(manifest.scripts["lint:scripts"], "node node_modules/eslint/bin/eslint.js scripts");
  assert.doesNotMatch(`${commitMsg}\n${preCommit}`, /\bnpx\b/);
  assert.doesNotMatch(lintStaged, /(?<!corepack )pnpm --filter/);
  assert.doesNotMatch(lintStaged, /(?:vitest|jest)\s+run/);
  assert.doesNotMatch(lintStaged, /eslint\s+\.\s+--fix/);
  assert.deepEqual(manifest["lint-staged"]["scripts/**/*.{js,mjs,cjs}"], [
    "prettier --write",
    "eslint --fix",
  ]);
  assert.deepEqual(
    prettierIgnore.split(/\r?\n/).filter((line) => line.startsWith("apps/uniapp/src/")),
    [
      "apps/uniapp/src/uni_modules/",
      "apps/uniapp/src/auto-imports.d.ts",
      "apps/uniapp/src/components.d.ts",
      "apps/uniapp/src/uni-pages.d.ts",
    ],
  );
  for (const ignoredPath of [
    "src/uni_modules/**/*",
    "src/auto-imports.d.ts",
    "src/components.d.ts",
    "src/uni-pages.d.ts",
  ]) {
    assert.ok(uniappEslint.includes(`"${ignoredPath}"`));
  }
  assert.match(attributes, /^\*\.bat text eol=crlf$/m);
  assert.match(attributes, /^\*\.cmd text eol=crlf$/m);
});

test("local secrets and generated mobile artifacts stay out of Git", () => {
  const probes = [
    ".env.staging.local",
    ".envrc",
    ".direnv/allow",
    ".npmrc",
    "apps/uniapp/unpackage/dist/build/app-plus/app-service.js",
    "apps/uniapp/release/petcare.keystore",
    "apps/uniapp/release/petcare.p12",
    "apps/uniapp/release/PetCare.mobileprovision",
    "apps/uniapp/release/petcare.apk",
    "apps/uniapp/release/petcare.aab",
    "apps/uniapp/release/petcare.ipa",
  ];
  const ignored = runGit(["check-ignore", "--verbose", "--stdin"], `${probes.join("\n")}\n`);
  assert.equal(ignored.status, 0, ignored.stderr);
  const rootGitignore = resolve(root, ".gitignore");
  const ignoredEntries = ignored.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [sourceAndRule, path] = line.split("\t");
      const match = /^(.*):\d+:(.*)$/.exec(sourceAndRule);

      assert.ok(match, `unexpected check-ignore output: ${line}`);
      return { path, source: resolve(root, match[1]) };
    });

  assert.deepEqual(ignoredEntries.map(({ path }) => path).sort(), probes.toSorted());
  assert.ok(
    ignoredEntries.every(({ source }) => source === rootGitignore),
    `ignored paths must be matched by the root .gitignore: ${ignored.stdout}`,
  );

  const trackedIgnored = runGit(["ls-files", "-ci", "--exclude-from=.gitignore"]);
  assert.equal(trackedIgnored.status, 0, trackedIgnored.stderr);
  assert.equal(trackedIgnored.stdout.trim(), "");
});
