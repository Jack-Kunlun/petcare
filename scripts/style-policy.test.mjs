import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkStylePolicy,
  extractMiniappThemeTokens,
  extractStaticClassNames,
  validateAdminTheme,
  validateMiniappClassName,
  validateMiniappTheme,
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
    validateStyleFile("miniapp", "apps/miniapp/src/app.css", "@theme { --spacing-mm: 20px; }"),
    [],
  );
  assert.notDeepEqual(validateStyleFile("miniapp", "apps/miniapp/src/app.scss", "@theme {}"), []);
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

test("Miniapp 主题提取语义 token 并拒绝非 px 关键值", () => {
  const theme = `
    @theme {
      --spacing-mm: 20px;
      --spacing-action: 240px;
      --text-base: 14px;
      --text-base--line-height: 20px;
      --radius-button: 12px;
      --color-brand: #20a66a;
    }
  `;

  assert.deepEqual([...extractMiniappThemeTokens(theme)].sort(), [
    "action",
    "base",
    "brand",
    "button",
    "mm",
  ]);
  assert.deepEqual(validateMiniappTheme(theme), []);
  assert.notDeepEqual(validateMiniappTheme(theme.replace("20px", "1rem")), []);
  assert.notDeepEqual(validateMiniappTheme(theme.replace("--color-brand: #20a66a;", "")), []);
});

test("Miniapp 真实入口满足 Tailwind v4 CSS-first 主题契约", async () => {
  const source = await readFile(path.join(repoRoot, "apps/miniapp/src/app.css"), "utf8");

  assert.deepEqual(validateMiniappTheme(source), []);
  assert.match(source, /@import "tailwindcss\/theme\.css" layer\(theme\);/);
  assert.match(source, /@import "tailwindcss\/utilities\.css" layer\(utilities\) source\("\."\);/);
  assert.match(source, /@source inline\("h-mm"\);/);
  assert.doesNotMatch(source, /preflight\.css|\d(?:\.\d+)?(?:rem|rpx)\b/i);
  assert.deepEqual(await checkStylePolicy(repoRoot, "miniapp"), []);
});

test("样式质量命令和 VS Code Tailwind v4 入口配置完整", async () => {
  const [rootPackage, miniappPackage, adminPackage, settings] = await Promise.all([
    readJson(path.join(repoRoot, "package.json")),
    readJson(path.join(repoRoot, "apps/miniapp/package.json")),
    readJson(path.join(repoRoot, "apps/admin/package.json")),
    readJson(path.join(repoRoot, ".vscode/settings.json")),
  ]);

  assert.equal(rootPackage.scripts["lint:styles"], "node scripts/style-policy.mjs all");
  assert.match(rootPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.match(rootPackage.scripts["test:tooling"], /style-policy\.test\.mjs/);
  assert.match(rootPackage.scripts["test:tooling"], /style-output-policy\.test\.mjs/);
  assert.equal(
    miniappPackage.scripts["lint:styles"],
    "node ../../scripts/style-policy.mjs miniapp",
  );
  assert.match(miniappPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(adminPackage.scripts["lint:styles"], "node ../../scripts/style-policy.mjs admin");
  assert.match(adminPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(settings["scss.lint.unknownAtRules"], "ignore");
  assert.equal(
    settings["tailwindCSS.experimental.configFile"]["apps/miniapp/src/app.css"],
    "apps/miniapp/**",
  );
  assert.equal(
    settings["tailwindCSS.experimental.configFile"]["apps/miniapp/tailwind.config.js"],
    undefined,
  );
});
