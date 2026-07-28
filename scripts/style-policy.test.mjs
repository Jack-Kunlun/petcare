import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  extractStaticClassNames,
  validateMiniappClassName,
  validateStyleFile,
} from "./style-policy.mjs";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("Miniapp 接受静态语义 token", () => {
  assert.deepEqual(validateMiniappClassName("flex h-mm bg-brand"), []);
  assert.deepEqual(extractStaticClassNames('<View className="h-mm text-base" />'), {
    classNames: ["h-mm", "text-base"],
    dynamicCount: 0,
  });
});

test("Miniapp 拒绝不安全和值编码类名", () => {
  for (const className of [
    "h-[20px]",
    "h-1/2",
    "h-20px",
    "bg-brand/50",
    "!w-full",
    "hover:bg-brand",
    "-mt-2",
  ]) {
    assert.notDeepEqual(validateMiniappClassName(className), [], className);
  }
});

test("Miniapp 拒绝动态类名片段", () => {
  assert.equal(extractStaticClassNames("<View className={`text-${tone}`} />").dynamicCount, 1);
  assert.equal(
    extractStaticClassNames('<View className={active ? "text-brand" : "text-muted"} />')
      .dynamicCount,
    1,
  );
});

test("Miniapp 只允许全局 app.scss", () => {
  assert.deepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/app.scss", "@tailwind utilities;"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/pages/index/index.scss", ".page {}"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/app.scss", "page { width: 1rpx; }"),
    [],
  );
});

test("Admin SCSS 不处理 Tailwind 指令", () => {
  assert.deepEqual(
    validateStyleFile("admin", "apps/admin/src/components/chart.scss", ".chart::before {}"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("admin", "apps/admin/src/components/chart.scss", ".chart { @apply p-4; }"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("admin", "apps/admin/src/components/chart.css", ".chart {}"),
    [],
  );
});
