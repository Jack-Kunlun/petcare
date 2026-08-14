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
  const prePush = await readFile(resolve(root, ".husky/pre-push"), "utf8");
  const commitCheck = await readFile(resolve(root, "scripts/commit-check.mjs"), "utf8");
  const commitScope = await readFile(resolve(root, "scripts/commit-scope.mjs"), "utf8");
  const attributes = await readFile(resolve(root, ".gitattributes"), "utf8");
  const prettierIgnore = await readFile(resolve(root, ".prettierignore"), "utf8");
  const miniappEslint = await readFile(resolve(root, "apps/miniapp/eslint.config.mjs"), "utf8");
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const lintStaged = JSON.stringify(manifest["lint-staged"]);

  assert.match(commitMsg, /^pnpm exec commitlint --edit$/m);
  assert.match(preCommit, /^pnpm exec lint-staged$/m);
  assert.match(preCommit, /^pnpm run commit:check$/m);
  assert.match(prePush, /refs\/heads\/master/u);
  assert.match(prePush, /git rev-list --min-parents=2/u);
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
  assert.doesNotMatch(`${commitMsg}\n${preCommit}\n${commitScope}\n${lintStaged}`, /corepack pnpm/);
  assert.doesNotMatch(lintStaged, /(?:vitest|jest)\s+run/);
  for (const commands of Object.values(manifest["lint-staged"])) {
    for (const command of commands) {
      if (command.includes("eslint")) {
        const eslintArguments = command
          .split(/\s+/)
          .slice(command.split(/\s+/).indexOf("eslint") + 1);

        assert.ok(eslintArguments.includes("--fix"));
        assert.ok(!eslintArguments.includes("."));
      }
      if (command.includes("prettier")) {
        assert.equal(command, "prettier --write");
      }
    }
  }
  assert.deepEqual(manifest["lint-staged"]["scripts/**/*.{js,mjs,cjs}"], [
    "prettier --write",
    "eslint --fix",
  ]);
  assert.deepEqual(manifest["lint-staged"]["apps/website/**/*.{astro,ts,css,json}"], [
    "prettier --write",
    "pnpm --filter @petcare/website exec -- eslint --fix",
  ]);
  assert.deepEqual(
    prettierIgnore.split(/\r?\n/).filter((line) => line.startsWith("apps/miniapp/src/")),
    [
      "apps/miniapp/src/uni_modules/",
      "apps/miniapp/src/auto-imports.d.ts",
      "apps/miniapp/src/components.d.ts",
      "apps/miniapp/src/uni-pages.d.ts",
    ],
  );
  for (const ignoredPath of ["apps/website/.astro/", "apps/website/dist/"]) {
    assert.ok(prettierIgnore.split(/\r?\n/).includes(ignoredPath));
  }
  for (const ignoredPath of [
    "src/uni_modules/**/*",
    "src/auto-imports.d.ts",
    "src/components.d.ts",
    "src/uni-pages.d.ts",
  ]) {
    assert.ok(miniappEslint.includes(`"${ignoredPath}"`));
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
    "apps/miniapp/unpackage/dist/build/app-plus/app-service.js",
    "apps/miniapp/release/petcare.keystore",
    "apps/miniapp/release/petcare.p12",
    "apps/miniapp/release/PetCare.mobileprovision",
    "apps/miniapp/release/petcare.apk",
    "apps/miniapp/release/petcare.aab",
    "apps/miniapp/release/petcare.ipa",
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

test("依赖安装只允许使用 pnpm", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const guard = resolve(root, "scripts/enforce-pnpm.mjs");

  assert.equal(manifest.packageManager, "pnpm@11.15.1");
  assert.equal(manifest.scripts.preinstall, "node scripts/enforce-pnpm.mjs");
  assert.equal(manifest.scripts["clean:modules"], "node scripts/clean.mjs --modules");

  const pnpm = spawnSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "pnpm/11.15.1 npm/? node/v24.19.0" },
  });
  const npm = spawnSync(process.execPath, [guard], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "npm/11.0.0 node/v24.19.0" },
  });

  assert.equal(pnpm.status, 0, pnpm.stderr);
  assert.notEqual(npm.status, 0);
  assert.match(npm.stderr, /pnpm@11\.15\.1/);

  const foreignLockfiles = runGit([
    "ls-files",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
  ]);
  assert.equal(foreignLockfiles.status, 0, foreignLockfiles.stderr);
  assert.equal(foreignLockfiles.stdout.trim(), "");
});
