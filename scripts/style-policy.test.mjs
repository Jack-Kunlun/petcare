import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkStylePolicy, validateAdminTheme, validateStyleFile } from "./style-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("Admin 样式文件保持单一 Tailwind 入口", () => {
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

test("Website 样式检查不复用 Admin 的唯一入口限制", () => {
  assert.deepEqual(
    validateStyleFile("website", "apps/website/src/styles/global.css", '@import "tailwindcss";'),
    [],
  );
  assert.deepEqual(
    validateStyleFile("website", "apps/website/src/components/hero.css", ".hero {}"),
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

test("Admin 与 Website 样式入口和命令满足仓库契约", async () => {
  const [source, rootPackage, adminPackage, websitePackage, settings] = await Promise.all([
    readFile(path.join(repoRoot, "apps/admin/src/index.css"), "utf8"),
    readJson(path.join(repoRoot, "package.json")),
    readJson(path.join(repoRoot, "apps/admin/package.json")),
    readJson(path.join(repoRoot, "apps/website/package.json")),
    readJson(path.join(repoRoot, ".vscode/settings.json")),
  ]);

  assert.deepEqual(validateAdminTheme(source), []);
  assert.deepEqual(await checkStylePolicy(repoRoot, "admin"), []);
  assert.deepEqual(await checkStylePolicy(repoRoot, "website"), []);
  assert.equal(
    rootPackage.scripts["lint:styles"],
    "node scripts/style-policy.mjs admin && node scripts/style-policy.mjs website",
  );
  assert.match(rootPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(adminPackage.scripts["lint:styles"], "node ../../scripts/style-policy.mjs admin");
  assert.match(adminPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(
    websitePackage.scripts["lint:styles"],
    "node ../../scripts/style-policy.mjs website",
  );
  assert.match(websitePackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(settings["scss.lint.unknownAtRules"], "ignore");
  assert.deepEqual(settings["tailwindCSS.experimental.configFile"], {
    "apps/admin/src/index.css": "apps/admin/**",
  });
});
