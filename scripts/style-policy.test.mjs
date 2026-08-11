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

test("Admin 真实入口和样式命令满足仓库契约", async () => {
  const [source, rootPackage, adminPackage, settings] = await Promise.all([
    readFile(path.join(repoRoot, "apps/admin/src/index.css"), "utf8"),
    readJson(path.join(repoRoot, "package.json")),
    readJson(path.join(repoRoot, "apps/admin/package.json")),
    readJson(path.join(repoRoot, ".vscode/settings.json")),
  ]);

  assert.deepEqual(validateAdminTheme(source), []);
  assert.deepEqual(await checkStylePolicy(repoRoot, "admin"), []);
  assert.equal(rootPackage.scripts["lint:styles"], "node scripts/style-policy.mjs admin");
  assert.match(rootPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(adminPackage.scripts["lint:styles"], "node ../../scripts/style-policy.mjs admin");
  assert.match(adminPackage.scripts.lint, /^pnpm lint:styles && /);
  assert.equal(settings["scss.lint.unknownAtRules"], "ignore");
  assert.deepEqual(settings["tailwindCSS.experimental.configFile"], {
    "apps/admin/src/index.css": "apps/admin/**",
  });
});
