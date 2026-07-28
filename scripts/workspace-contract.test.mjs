import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const manifests = [
  "apps/admin/package.json",
  "apps/server/package.json",
  "apps/miniapp/package.json",
  "packages/api-client/package.json",
  "packages/shared-types/package.json",
  "packages/shared-utils/package.json",
  "packages/eslint-config-base/package.json",
];
const lifecycle = ["dev", "build", "typecheck", "lint", "test", "test:coverage", "clean"];

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

test("所有工作区暴露标准生命周期", async () => {
  for (const path of manifests) {
    const manifest = await readJson(path);

    for (const script of lifecycle) {
      assert.equal(typeof manifest.scripts?.[script], "string", `${path} 缺少 ${script}`);
    }
  }
});

test("根级命令覆盖质量门禁与三端开发", async () => {
  const manifest = await readJson("package.json");

  assert.equal(manifest.engines.node, ">=22.0.0 <23");
  assert.equal(manifest.engines.pnpm, ">=11.0.0 <12");
  assert.match(manifest.scripts.dev, /@petcare\/admin/);
  assert.match(manifest.scripts.dev, /@petcare\/server/);
  assert.match(manifest.scripts.dev, /@petcare\/miniapp/);
  assert.match(manifest.scripts.check, /format:check.*lint.*typecheck.*test.*build/);
});

test("Miniapp 内部脚本不嵌套 npm", async () => {
  const manifest = await readJson("apps/miniapp/package.json");

  assert.doesNotMatch(JSON.stringify(manifest.scripts), /\bnpm run\b/);
});

test("Server 类型检查复用 Nest 构建边界，无产物包覆盖 Turbo 输出", async () => {
  const server = await readJson("apps/server/package.json");
  const eslintTurbo = await readJson("packages/eslint-config-base/turbo.json");

  assert.equal(server.scripts.typecheck, "tsc --noEmit -p tsconfig.build.json");
  assert.match(server.scripts["test:e2e"], /--env-file-if-exists=\.\.\/\.\.\/\.env/);
  assert.deepEqual(eslintTurbo.tasks.build.outputs, []);
});

test("空测试工作区允许生成零覆盖率报告，无产物任务不声明缓存输出", async () => {
  const sharedUtils = await readJson("packages/shared-utils/package.json");
  const eslintTurbo = await readJson("packages/eslint-config-base/turbo.json");

  assert.match(sharedUtils.scripts["test:coverage"], /--passWithNoTests/);
  assert.deepEqual(eslintTurbo.tasks["test:coverage"].outputs, []);
});
