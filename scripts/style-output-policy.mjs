import console from "node:console";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export async function checkAdminOutput(outputRoot) {
  const files = await collectFiles(outputRoot);
  const cssSources = [];
  const violations = [];

  for (const file of files) {
    if (path.extname(file) !== ".css") {
      continue;
    }

    const source = await readFile(file, "utf8");
    const relativePath = path.relative(outputRoot, file).replaceAll("\\", "/");
    cssSources.push(source);

    if (/\d(?:\.\d+)?rem\b/i.test(source)) {
      violations.push(`${relativePath}: Admin CSS 禁止 rem`);
    }
    if (/\d(?:\.\d+)?rpx\b/i.test(source)) {
      violations.push(`${relativePath}: Admin CSS 禁止 rpx`);
    }
  }

  if (!cssSources.join("\n").includes("font-size:14px")) {
    violations.push("Admin CSS 缺少默认字号声明：font-size:14px");
  }

  return violations;
}

async function collectFiles(root) {
  const files = [];

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function runCli() {
  const target = process.argv[2];
  const outputRoot = process.argv[3];

  if (target !== "admin" || !outputRoot) {
    throw new Error("用法：node scripts/style-output-policy.mjs admin <output-directory>");
  }

  const violations = await checkAdminOutput(path.resolve(outputRoot));

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exitCode = 1;
    return;
  }

  console.log("样式产物检查通过：admin");
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await runCli();
}
