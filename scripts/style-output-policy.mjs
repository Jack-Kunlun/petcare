import console from "node:console";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const MINIAPP_REQUIRED_DECLARATIONS = [
  {
    label: "font-size:14px",
    patterns: [/font-size\s*:\s*14px\b/],
  },
  {
    label: "height:20px",
    patterns: [/--spacing-mm\s*:\s*20px\b/, /\.h-mm\s*\{[^}]*height\s*:\s*var\(--spacing-mm\)/s],
  },
  {
    label: "width:240px",
    patterns: [
      /--spacing-action\s*:\s*240px\b/,
      /\.w-action\s*\{[^}]*width\s*:\s*var\(--spacing-action\)/s,
    ],
  },
  {
    label: "border-radius:8px",
    patterns: [
      /--radius-button\s*:\s*8px\b/,
      /\.rounded-button\s*\{[^}]*border-radius\s*:\s*var\(--radius-button\)/s,
    ],
  },
];

export async function checkMiniappOutput(outputRoot) {
  const files = await collectFiles(outputRoot);
  const violations = [];
  const wxssSources = [];

  for (const file of files) {
    const extension = path.extname(file);

    if (extension !== ".wxss" && extension !== ".js") {
      continue;
    }

    const source = await readFile(file, "utf8");
    const relativePath = path.relative(outputRoot, file).replaceAll("\\", "/");

    if (/\bNaN\b/.test(source)) {
      violations.push(`${relativePath}: 构建产物禁止 NaN`);
    }

    if (extension === ".js") {
      if (/\bprocess(?:\.|\[)/.test(source)) {
        violations.push(`${relativePath}: 小程序运行时代码禁止 process`);
      }
      continue;
    }

    wxssSources.push(source);

    if (/\d(?:\.\d+)?rem\b/i.test(source)) {
      violations.push(`${relativePath}: WXSS 禁止 rem`);
    }
    if (/\d(?:\.\d+)?rpx\b/i.test(source)) {
      violations.push(`${relativePath}: WXSS 禁止 rpx`);
    }
    if (/\\(?:!|\[|\]|\(|\)|:|\/)/.test(source)) {
      violations.push(`${relativePath}: WXSS 存在未转换的 Tailwind 转义`);
    }
    if (/(^|[,>{}+~]\s*)\*(?=[:{.,>+~\s]|$)/m.test(source)) {
      violations.push(`${relativePath}: WXSS 禁止通用选择器`);
    }
  }

  const combinedWxss = wxssSources.join("\n");

  for (const declaration of MINIAPP_REQUIRED_DECLARATIONS) {
    if (!declaration.patterns.every((pattern) => pattern.test(combinedWxss))) {
      violations.push(`Miniapp WXSS 缺少关键声明：${declaration.label}`);
    }
  }

  return violations;
}

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

  if (!target || !outputRoot || !["miniapp", "admin"].includes(target)) {
    throw new Error(
      "用法：node scripts/style-output-policy.mjs <miniapp|admin> <output-directory>",
    );
  }

  const resolvedRoot = path.resolve(outputRoot);
  const violations =
    target === "miniapp"
      ? await checkMiniappOutput(resolvedRoot)
      : await checkAdminOutput(resolvedRoot);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(violation);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`样式产物检查通过：${target}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  await runCli();
}
