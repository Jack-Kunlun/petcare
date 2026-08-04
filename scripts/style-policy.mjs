import console from "node:console";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const SOURCE_EXTENSIONS = new Set([".css", ".js", ".jsx", ".scss", ".ts", ".tsx"]);
const VALUE_ENCODED_CLASS =
  /^-?(?:h|w|min-h|max-h|min-w|max-w|p[trblxy]?|m[trblxy]?|gap[xy]?|inset[xy]?|top|right|bottom|left|text|rounded|border)-\d+(?:px|rpx|rem|vh|vw|%)?$/;

export function validateMiniappClassName(className) {
  const violations = [];

  for (const token of className.trim().split(/\s+/).filter(Boolean)) {
    if (["[", "]", "(", ")"].some((character) => token.includes(character))) {
      violations.push(`${token}: 禁止任意值或变量简写`);
    }
    if (token.includes("/")) {
      violations.push(`${token}: 禁止分数或透明度简写`);
    }
    if (token.includes("!")) {
      violations.push(`${token}: 禁止 important 修饰`);
    }
    if (token.includes(":")) {
      violations.push(`${token}: 变体未加入白名单`);
    }
    if (VALUE_ENCODED_CLASS.test(token)) {
      violations.push(`${token}: 必须改用配置别名`);
    }
  }

  return violations;
}

export function extractStaticClassNames(source) {
  const classNames = [];
  let matchedAttributes = 0;
  let dynamicTemplates = 0;
  const literalPattern =
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*`([^`]*)`\s*\})/gs;

  for (const match of source.matchAll(literalPattern)) {
    matchedAttributes += 1;
    const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";

    if (value.includes("${")) {
      dynamicTemplates += 1;
      continue;
    }

    classNames.push(...value.trim().split(/\s+/).filter(Boolean));
  }

  const totalAttributes = [...source.matchAll(/className\s*=/g)].length;

  return {
    classNames,
    dynamicCount: totalAttributes - matchedAttributes + dynamicTemplates,
  };
}

export function validateStyleFile(scope, relativePath, source) {
  const violations = [];
  const normalizedPath = relativePath.replaceAll("\\", "/");

  if (scope === "miniapp" && /\.(?:css|scss)$/.test(normalizedPath)) {
    if (normalizedPath !== "apps/miniapp/src/app.css") {
      violations.push(`${normalizedPath}: Miniapp 禁止页面级样式文件`);
    }
    if (/\d(?:\.\d+)?(?:rem|rpx)\b/i.test(source)) {
      violations.push(`${normalizedPath}: Miniapp 样式禁止 rem/rpx`);
    }
  }

  if (scope === "admin" && normalizedPath.endsWith(".css")) {
    if (normalizedPath !== "apps/admin/src/index.css") {
      violations.push(`${normalizedPath}: Admin 仅允许 index.css 作为 Tailwind 入口`);
    }
  }

  if (
    scope === "admin" &&
    normalizedPath.endsWith(".scss") &&
    /@(theme|tailwind|apply)\b/.test(source)
  ) {
    violations.push(`${normalizedPath}: Admin SCSS 禁止 Tailwind 指令`);
  }

  return violations;
}

export function extractMiniappThemeTokens(source) {
  const tokens = new Set();
  const tokenPattern = /--(?:spacing|color|text|radius|shadow)-([a-z][a-z0-9-]*):/g;

  for (const match of source.matchAll(tokenPattern)) {
    const name = match[1];

    if (!name.endsWith("--line-height")) {
      tokens.add(name);
    }
  }

  return tokens;
}

export function validateMiniappTheme(source) {
  const violations = [];
  const themeMatch = source.match(/@theme(?:\s+[^{]+)?\s*\{([\s\S]*?)\}/);
  const theme = themeMatch?.[1] ?? "";
  const requiredDeclarations = [
    ["--spacing-mm", "20px"],
    ["--spacing-action", "240px"],
    ["--text-base", "14px"],
    ["--radius-button", "8px"],
    ["--color-brand", "#4a6cf7"],
  ];

  if (!themeMatch) {
    violations.push("Miniapp 缺少 @theme 主题块");
  }

  for (const [name, value] of requiredDeclarations) {
    const pattern = new RegExp(`${name}\\s*:\\s*${escapeRegExp(value)}\\s*;`);

    if (!pattern.test(theme)) {
      violations.push(`Miniapp @theme 缺少精确声明：${name}: ${value}`);
    }
  }

  if (/\d(?:\.\d+)?(?:rem|rpx)\b/i.test(theme)) {
    violations.push("Miniapp @theme 禁止 rem/rpx");
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

export async function checkStylePolicy(repoRoot = DEFAULT_REPO_ROOT, scope = "all") {
  const scopes = scope === "all" ? ["miniapp", "admin"] : [scope];
  const violations = [];

  for (const currentScope of scopes) {
    if (currentScope !== "miniapp" && currentScope !== "admin") {
      throw new Error(`未知样式检查范围：${currentScope}`);
    }

    const sourceRoot = path.join(repoRoot, "apps", currentScope, "src");
    const files = await collectSourceFiles(sourceRoot);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const relativePath = path.relative(repoRoot, file).replaceAll("\\", "/");

      violations.push(...validateStyleFile(currentScope, relativePath, source));

      if (relativePath === "apps/miniapp/src/app.css") {
        violations.push(...validateMiniappTheme(source));
      }

      if (relativePath === "apps/admin/src/index.css") {
        violations.push(...validateAdminTheme(source));
      }

      if (currentScope !== "miniapp" || !/\.[jt]sx?$/.test(file)) {
        continue;
      }

      const extracted = extractStaticClassNames(source);

      if (extracted.dynamicCount > 0) {
        violations.push(`${relativePath}: Miniapp 禁止动态 className 表达式`);
      }

      for (const className of extracted.classNames) {
        for (const violation of validateMiniappClassName(className)) {
          violations.push(`${relativePath}: ${violation}`);
        }
      }
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
  const scope = process.argv[2] ?? "all";
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
