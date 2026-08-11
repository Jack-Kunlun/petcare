import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const uniappRoot = resolve(repositoryRoot, "apps/uniapp");

test("UniApp contains only the minimal PetCare shell", async () => {
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
    await assert.rejects(access(resolve(uniappRoot, relativePath)));
  }

  const main = await readFile(resolve(uniappRoot, "src/main.ts"), "utf8");
  const page = await readFile(resolve(uniappRoot, "src/pages/index/index.vue"), "utf8");
  const manifest = JSON.parse(await readFile(resolve(uniappRoot, "package.json"), "utf8"));

  assert.doesNotMatch(main, /router|pinia|persistPlugin/);
  assert.match(page, /PetCare/);
  assert.match(page, /<wd-button/);
  assert.match(page, /(?:flex|items-center|rounded)/);

  const forbiddenDependencies = [
    "@alova/adapter-uniapp",
    "@alova/mock",
    "@alova/shared",
    "@vueuse/core",
    "@wot-ui/router",
    "alova",
    "echarts",
    "pinia",
    "uni-echarts",
    "vue-i18n",
    "zrender",
  ];

  for (const dependency of forbiddenDependencies) {
    assert.equal(manifest.dependencies?.[dependency], undefined, dependency);
  }

  const forbiddenPlatformDependencies = [
    "@dcloudio/uni-app-harmony",
    "@dcloudio/uni-mp-alipay",
    "@dcloudio/uni-mp-baidu",
    "@dcloudio/uni-mp-harmony",
    "@dcloudio/uni-mp-jd",
    "@dcloudio/uni-mp-kuaishou",
    "@dcloudio/uni-mp-lark",
    "@dcloudio/uni-mp-qq",
    "@dcloudio/uni-mp-toutiao",
    "@dcloudio/uni-mp-xhs",
    "@dcloudio/uni-quickapp-webview",
  ];

  for (const dependency of forbiddenPlatformDependencies) {
    assert.equal(manifest.dependencies?.[dependency], undefined, dependency);
  }

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
