import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const miniappRoot = resolve(repositoryRoot, "apps/miniapp");

test("Miniapp contains only the minimal PetCare UniApp shell", async () => {
  for (const relativePath of [
    "src/api",
    "src/components",
    "src/composables",
    "src/customize-tab-bar",
    "src/layouts",
    "src/router",
    "src/store",
    "src/subPages",
    "src/subEcharts",
    "src/subAsyncEcharts",
    "src/uni_modules/mp-html",
  ]) {
    await assert.rejects(access(resolve(miniappRoot, relativePath)));
  }

  const main = await readFile(resolve(miniappRoot, "src/main.ts"), "utf8");
  const page = await readFile(resolve(miniappRoot, "src/pages/index/index.vue"), "utf8");
  const componentsDeclaration = await readFile(resolve(miniappRoot, "src/components.d.ts"), "utf8");
  const manifest = JSON.parse(await readFile(resolve(miniappRoot, "package.json"), "utf8"));

  assert.doesNotMatch(main, /router|pinia|persistPlugin/);
  assert.match(page, /PetCare/);
  assert.match(page, /<wd-button/);
  assert.match(page, /(?:flex|items-center|rounded)/);
  assert.match(componentsDeclaration, /WdButton:/);
  assert.doesNotMatch(
    componentsDeclaration,
    /DemoBlock|GlobalDialog|GlobalLoading|GlobalToast|PrivacyPopup|UniEcharts/,
  );

  const runtimeDependencies = [
    "@dcloudio/uni-app",
    "@dcloudio/uni-app-plus",
    "@dcloudio/uni-components",
    "@dcloudio/uni-h5",
    "@dcloudio/uni-mp-weixin",
    "@wot-ui/ui",
    "@wot-ui/unocss-preset",
    "tslib",
    "vue",
  ];
  const developmentDependencies = [
    "@dcloudio/types",
    "@dcloudio/vite-plugin-uni",
    "@petcare/eslint-config-base",
    "@types/node",
    "@uni-helper/eslint-config",
    "@uni-helper/plugin-uni",
    "@uni-helper/uni-types",
    "@uni-helper/unocss-preset-uni",
    "@uni-helper/vite-plugin-uni-components",
    "@uni-helper/vite-plugin-uni-manifest",
    "@uni-helper/vite-plugin-uni-pages",
    "@unocss/eslint-config",
    "@vitest/coverage-v8",
    "@vue/tsconfig",
    "eslint",
    "miniprogram-api-typings",
    "miniprogram-ci",
    "sass",
    "typescript",
    "unocss",
    "unplugin-auto-import",
    "vite",
    "vitest",
    "vue-tsc",
  ];

  assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), runtimeDependencies.sort());
  assert.deepEqual(
    Object.keys(manifest.devDependencies ?? {}).sort(),
    developmentDependencies.sort(),
  );

  const lifecycleScripts = ["dev", "build", "typecheck", "lint", "test", "test:coverage", "clean"];
  const targetScripts = [
    "dev:h5",
    "dev:mp-weixin",
    "dev:app-android",
    "dev:app-ios",
    "build:h5",
    "build:mp-weixin",
    "build:app-android",
    "build:app-ios",
  ];

  for (const script of targetScripts) {
    assert.equal(typeof manifest.scripts?.[script], "string", script);
  }
  assert.deepEqual(
    Object.keys(manifest.scripts ?? {}).sort(),
    [...lifecycleScripts, ...targetScripts].sort(),
  );
});
