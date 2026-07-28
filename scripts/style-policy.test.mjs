import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  extractStaticClassNames,
  validateAdminTheme,
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

test("Miniapp 只允许 Tailwind v4 纯 CSS 入口 app.css", () => {
  assert.deepEqual(
    validateStyleFile(
      "miniapp",
      "apps/miniapp/src/app.css",
      "@theme { --spacing-mm: 20px; }",
    ),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/app.scss", "@theme {}"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/pages/index/index.scss", ".page {}"),
    [],
  );
  assert.notDeepEqual(
    validateStyleFile("miniapp", "apps/miniapp/src/app.css", "page { width: 1rpx; }"),
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

test("Admin 主题只使用明确的 px 设计 token", () => {
  const validTheme = `
    @theme {
      --spacing: 4px;
      --text-base: 14px;
      --breakpoint-md: 768px;
      --breakpoint-lg: 1024px;
      --container-md: 448px;
      --radius: 8px;
    }

    html {
      font-size: 14px;
    }
  `;

  assert.deepEqual(validateAdminTheme(validTheme), []);
  assert.notDeepEqual(validateAdminTheme(validTheme.replace("4px", "0.25rem")), []);
  assert.notDeepEqual(validateAdminTheme(validTheme.replace("--container-md: 448px;", "")), []);
  assert.notDeepEqual(validateAdminTheme(validTheme.replace("font-size: 14px;", "")), []);
});

test("Admin 真实 Tailwind 入口满足 px 主题契约", async () => {
  const source = await readFile(path.join(repoRoot, "apps/admin/src/index.css"), "utf8");

  assert.deepEqual(validateAdminTheme(source), []);
});
