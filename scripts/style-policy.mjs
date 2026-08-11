import console from "node:console";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SOURCE_EXTENSIONS = new Set([".css", ".scss"]);

export function validateStyleFile(scope, relativePath, source) {
  if (scope !== "admin") {
    throw new Error(`未知样式检查范围：${scope}`);
  }

  const violations = [];
  const normalizedPath = relativePath.replaceAll("\\", "/");

  if (normalizedPath.endsWith(".css") && normalizedPath !== "apps/admin/src/index.css") {
    violations.push(`${normalizedPath}: Admin 仅允许 index.css 作为 Tailwind 入口`);
  }

  if (normalizedPath.endsWith(".scss") && /@(theme|tailwind|apply)\b/.test(source)) {
    violations.push(`${normalizedPath}: Admin SCSS 禁止 Tailwind 指令`);
  }

  return violations;
}

export function validateAdminTheme(source) {
  const violations = [];
  const themeMatch = source.match(/@theme(?:\s+[^{]+)?\s*\{([\s\S]*?)\}/);
  const theme = themeMatch?.[1] ?? "";
  const requiredDeclarations = [
    ["--spacing", "4px"],
    ["--text-base", "14px"],
    ["--breakpoint-md", "768px"],
    ["--breakpoint-lg", "1024px"],
    ["--container-md", "448px"],
  ];

  if (!themeMatch) {
    violations.push("Admin 缺少 @theme 主题块");
  }

  for (const [name, value] of requiredDeclarations) {
    const pattern = new RegExp(`${name}\\s*:\\s*${escapeRegExp(value)}\\s*;`);

    if (!pattern.test(theme)) {
      violations.push(`Admin @theme 缺少精确声明：${name}: ${value}`);
    }
  }

  if (/\d(?:\.\d+)?(?:rem|rpx)\b/i.test(theme)) {
    violations.push("Admin @theme 禁止 rem/rpx");
  }

  if (!/html\s*\{[^}]*font-size\s*:\s*14px\s*;/s.test(source)) {
    violations.push("Admin html 缺少默认字号：font-size: 14px");
  }

  return violations;
}

export async function checkStylePolicy(repoRoot = DEFAULT_REPO_ROOT, scope = "admin") {
  if (scope !== "admin") {
    throw new Error(`未知样式检查范围：${scope}`);
  }

  const violations = [];
  const sourceRoot = path.join(repoRoot, "apps", "admin", "src");

  for (const file of await collectSourceFiles(sourceRoot)) {
    const source = await readFile(file, "utf8");
    const relativePath = path.relative(repoRoot, file).replaceAll("\\", "/");

    violations.push(...validateStyleFile(scope, relativePath, source));

    if (relativePath === "apps/admin/src/index.css") {
      violations.push(...validateAdminTheme(source));
    }
  }

  return violations;
}

async function collectSourceFiles(root) {
  const files = [];

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runCli() {
  const scope = process.argv[2] ?? "admin";
  const violations = await checkStylePolicy(DEFAULT_REPO_ROOT, scope);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`样式策略检查通过：${scope}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await runCli();
}
