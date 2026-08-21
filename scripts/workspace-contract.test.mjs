import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const manifests = [
  "apps/admin/package.json",
  "apps/server/package.json",
  "apps/miniapp/package.json",
  "apps/website/package.json",
  "packages/api-client/package.json",
  "packages/shared-types/package.json",
  "packages/shared-utils/package.json",
  "packages/eslint-config-base/package.json",
];
const lifecycle = ["dev", "build", "typecheck", "lint", "test", "test:coverage", "clean"];

test("Miniapp workspace preserves the UniApp target contract", async () => {
  const manifest = await readJson("apps/miniapp/package.json");
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

  assert.equal(manifest.name, "@petcare/miniapp");
  for (const script of [...lifecycle, ...requiredTargetScripts]) {
    assert.equal(
      typeof manifest.scripts?.[script],
      "string",
      `apps/miniapp/package.json is missing ${script}`,
    );
  }
});

test("UniApp H5 compiler resolves its compatible Vite runtime", async () => {
  const manifest = await readJson("apps/miniapp/package.json");
  const workspace = await readFile(resolve(root, "pnpm-workspace.yaml"), "utf8");
  const compilerVersion = manifest.dependencies["@dcloudio/uni-app"];

  assert.match(workspace, /["']@dcloudio\/uni-h5-vite@3\.0\.0-4080520251106001["']:/);
  assert.match(workspace, /vite:\s*["']5\.4\.21["']/);
  assert.match(
    workspace,
    /["']@wot-ui\/ui@2\.3\.1["']:\s*\n\s+peerDependencies:\s*\n\s+["']@dcloudio\/uni-app["']:\s*["']3\.0\.0-4080520251106001["']/,
  );
  assert.match(
    workspace,
    /["']@dcloudio\/uni-cli-shared@3\.0\.0-4080520251106001["']:\s*\n\s+dependencies:\s*\n\s+postcss:\s*["']8\.4\.45["']/,
  );
  assert.equal(manifest.devDependencies.vite, "5.4.21");
  assert.equal(manifest.devDependencies.vitest, manifest.devDependencies["@vitest/coverage-v8"]);
  for (const dependency of [
    "@dcloudio/uni-app-plus",
    "@dcloudio/uni-components",
    "@dcloudio/uni-h5",
    "@dcloudio/uni-mp-weixin",
  ]) {
    assert.equal(manifest.dependencies[dependency], compilerVersion);
  }
  assert.equal(manifest.devDependencies["@dcloudio/vite-plugin-uni"], compilerVersion);
});

test("依赖清单使用精确版本", async () => {
  const workspace = await readFile(resolve(root, "pnpm-workspace.yaml"), "utf8");

  assert.match(workspace, /^saveExact: true$/m);
  for (const path of ["package.json", ...manifests]) {
    const manifest = await readJson(path);

    for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const [dependency, version] of Object.entries(manifest[section] ?? {})) {
        if (version.startsWith("workspace:")) continue;
        assert.match(
          version,
          /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
          `${path} 的 ${dependency} 必须使用精确版本`,
        );
      }
    }
  }
});

test("pnpm 自动使用项目版本并严格校验 Node 兼容性", async () => {
  const workspace = await readFile(resolve(root, "pnpm-workspace.yaml"), "utf8");

  assert.match(workspace, /^pmOnFail: download$/m);
  assert.match(workspace, /^engineStrict: true$/m);
  assert.match(workspace, /^nodeVersion: "24\.19\.0"$/m);
});

test("README 覆盖首次启动和 pnpm 升级路径", async () => {
  const readme = await readFile(resolve(root, "README.md"), "utf8");
  const startupCommands = [
    "corepack enable",
    "corepack install",
    "pnpm install --frozen-lockfile",
    "docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up -d postgres redis",
    "pnpm --filter @petcare/server prisma:migrate:deploy",
    "pnpm --filter @petcare/server prisma:seed",
    "pnpm dev",
  ];
  let previousIndex = -1;

  for (const command of startupCommands) {
    const index = readme.indexOf(command);
    assert.ok(index > previousIndex, `README 缺少或顺序错误: ${command}`);
    previousIndex = index;
  }

  assert.match(readme, /corepack use pnpm@<目标版本>/);
  assert.match(readme, /packageManager/);
});

test("Admin E2E 文档使用开发 Compose 覆盖暴露基础设施端口", async () => {
  const readme = await readFile(resolve(root, "apps/admin/e2e/README.md"), "utf8");

  assert.match(
    readme,
    /docker compose -f docker-compose\.yml -f docker-compose\.dev\.yml --env-file \.env up -d postgres redis/,
  );
  assert.doesNotMatch(readme, /^docker compose up -d postgres redis$/m);
});

test("Server exposes committed Prisma migration lifecycle commands", async () => {
  const server = await readJson("apps/server/package.json");

  assert.equal(
    server.scripts["prisma:migrate:create"],
    "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate dev",
  );
  assert.equal(
    server.scripts["prisma:migrate:deploy"],
    "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate deploy",
  );
  assert.equal(
    server.scripts["prisma:migrate:status"],
    "node --env-file-if-exists=../../.env node_modules/prisma/build/index.js migrate status",
  );
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

test("根级命令覆盖质量门禁与全部应用开发", async () => {
  const manifest = await readJson("package.json");
  const workspace = await readFile(resolve(root, "pnpm-workspace.yaml"), "utf8");

  assert.equal(manifest.engines.node, ">=24.12.0 <25");
  assert.equal(manifest.engines.pnpm, ">=11.0.0 <12");

  const miniappManifest = await readJson("apps/miniapp/package.json");
  assert.equal(miniappManifest.engines.node, manifest.engines.node);
  assert.equal(miniappManifest.engines.pnpm, manifest.engines.pnpm);
  assert.match(manifest.scripts.dev, /@petcare\/admin/);
  assert.match(manifest.scripts.dev, /@petcare\/server/);
  assert.match(manifest.scripts.dev, /@petcare\/miniapp/);
  assert.match(manifest.scripts.dev, /@petcare\/website/);
  assert.equal(manifest.scripts["dev:website"], "pnpm --filter @petcare/website dev");
  assert.equal(manifest.scripts["build:website"], "pnpm --filter @petcare/website build");
  assert.equal(manifest.scripts["start:website"], "pnpm --filter @petcare/website start");

  const websiteManifest = await readJson("apps/website/package.json");
  assert.equal(websiteManifest.scripts.start, "node dist/server/entry.mjs");
  assert.match(manifest.scripts.check, /format:check.*lint.*typecheck.*test.*build/);
  assert.match(workspace, /^\s*- "apps\/\*"$/m);
  assert.equal(manifest.scripts.build, "turbo run build");
  assert.equal(manifest.scripts.typecheck, "turbo run typecheck");
  assert.match(manifest.scripts.lint, /turbo run lint$/);
  assert.equal(manifest.scripts.test, "pnpm test:tooling && turbo run test");

  for (const target of ["h5", "mp-weixin", "app-android", "app-ios"]) {
    assert.equal(
      manifest.scripts[`dev:miniapp:${target}`],
      `pnpm --filter @petcare/miniapp dev:${target}`,
    );
    assert.equal(
      manifest.scripts[`build:miniapp:${target}`],
      `pnpm --filter @petcare/miniapp build:${target}`,
    );
    assert.equal(manifest.scripts[`dev:uniapp:${target}`], undefined);
    assert.equal(manifest.scripts[`build:uniapp:${target}`], undefined);
  }
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
