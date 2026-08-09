import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const manifests = [
  "apps/admin/package.json",
  "apps/server/package.json",
  "apps/miniapp/package.json",
  "apps/uniapp/package.json",
  "packages/api-client/package.json",
  "packages/shared-types/package.json",
  "packages/shared-utils/package.json",
  "packages/eslint-config-base/package.json",
];
const lifecycle = ["dev", "build", "typecheck", "lint", "test", "test:coverage", "clean"];

test("UniApp workspace uses the official Vitesse scaffold contract", async () => {
  const manifest = await readJson("apps/uniapp/package.json");
  const requiredTargetScripts = [
    "dev:h5",
    "dev:mp-weixin",
    "dev:app-android",
    "dev:app-ios",
    "build:h5",
    "build:mp-weixin",
    "build:app-android",
    "build:app-ios",
  ];

  assert.equal(manifest.name, "@petcare/uniapp");
  for (const script of [...lifecycle, ...requiredTargetScripts]) {
    assert.equal(typeof manifest.scripts?.[script], "string", `apps/uniapp/package.json is missing ${script}`);
  }
});

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

test("Server tsconfig 不依赖跨版本弃用屏蔽", async () => {
  const serverTsconfig = await readJson("apps/server/tsconfig.json");

  assert.equal(serverTsconfig.compilerOptions.ignoreDeprecations, undefined);
  assert.equal(serverTsconfig.compilerOptions.baseUrl, undefined);
  assert.deepEqual(serverTsconfig.compilerOptions.paths["@/*"], ["./src/*"]);
  assert.deepEqual(serverTsconfig.include, ["src/**/*.ts"]);
  assert.deepEqual(serverTsconfig.exclude, ["node_modules", "dist", "test", "prisma"]);
});

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

  assert.equal(manifest.engines.node, ">=22.18.0 <23");
  assert.equal(manifest.engines.pnpm, ">=11.0.0 <12");
  assert.match(manifest.scripts.dev, /@petcare\/admin/);
  assert.match(manifest.scripts.dev, /@petcare\/server/);
  assert.match(manifest.scripts.dev, /@petcare\/miniapp/);
  assert.match(manifest.scripts.check, /format:check.*lint.*typecheck.*test.*build/);

  for (const target of ["h5", "mp-weixin", "app-android", "app-ios"]) {
    assert.equal(manifest.scripts[`dev:uniapp:${target}`], `pnpm --filter @petcare/uniapp dev:${target}`);
    assert.equal(manifest.scripts[`build:uniapp:${target}`], `pnpm --filter @petcare/uniapp build:${target}`);
  }
});

test("Miniapp 内部脚本不嵌套 npm", async () => {
  const manifest = await readJson("apps/miniapp/package.json");

  assert.doesNotMatch(JSON.stringify(manifest.scripts), /\bnpm run\b/);
});

test("Miniapp 开发命令直接启用 Taro watch", async () => {
  const manifest = await readJson("apps/miniapp/package.json");

  assert.equal(manifest.scripts["dev:weapp"], "taro build --type weapp --watch");
  assert.equal(manifest.scripts["dev:h5"], "taro build --type h5 --watch");
});

test("Miniapp 产物不依赖 WXSS 通配选择器或运行时 process", async () => {
  const appCss = await readFile(resolve(root, "apps/miniapp/src/app.css"), "utf8");
  const request = await readFile(resolve(root, "apps/miniapp/src/api/request.ts"), "utf8");
  const config = await readFile(resolve(root, "apps/miniapp/config/index.ts"), "utf8");

  assert.doesNotMatch(appCss, /@tailwind\s+(?:base|components)/);
  assert.doesNotMatch(request, /\bprocess\.env\b/);
  assert.match(config, /__API_BASE_URL__/);
  assert.match(config, /deviceRatio:\s*\{\s*750:\s*1,\s*\}/);
});

test("Miniapp Jest 串行运行以避免 Taro 环境 worker 退出告警", async () => {
  const manifest = await readJson("apps/miniapp/package.json");

  assert.match(manifest.scripts.test, /--runInBand/);
  assert.match(manifest.scripts["test:coverage"], /--runInBand/);
});

test("Server 依赖 Prisma Client 的命令在编译前显式生成客户端", async () => {
  const manifest = await readJson("apps/server/package.json");
  const generatedClientLifecycles = ["typecheck", "test", "test:cov", "test:coverage", "test:e2e"];

  for (const lifecycle of generatedClientLifecycles) {
    assert.match(
      manifest.scripts[`pre${lifecycle}`],
      /(?:^|&&\s*)pnpm prisma:generate$/,
      `${lifecycle} 在编译或 Jest 前必须生成最新 Prisma Client`,
    );
  }

  assert.match(
    manifest.scripts.pretypecheck,
    /^pnpm --filter @petcare\/shared-types build && /,
    "typecheck 在生成 Prisma Client 前必须构建 shared-types",
  );
});

test("Server 测试串行运行以避免 Turbo 嵌套 worker 退出告警", async () => {
  const manifest = await readJson("apps/server/package.json");

  assert.match(manifest.scripts.test, /--runInBand/);
  assert.match(manifest.scripts["test:coverage"], /--runInBand/);
});

test("Miniapp 提供微信开发者工具和本地 API 配置", async () => {
  const project = await readJson("apps/miniapp/project.config.json");
  const envExample = await readFile(resolve(root, ".env.example"), "utf8");

  assert.equal(project.appid, "wx3bdad4ab652f0d1d");
  assert.equal(project.miniprogramRoot, "dist/");
  assert.match(envExample, /^TARO_APP_API_BASE_URL=http:\/\/localhost:3000$/m);
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
