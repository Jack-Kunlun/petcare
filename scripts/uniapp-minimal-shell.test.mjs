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
  assert.doesNotMatch(main, /router|pinia|persistPlugin/);
  assert.match(page, /PetCare/);
  assert.match(page, /<wd-button/);
  assert.match(page, /(?:flex|items-center|rounded)/);
});
