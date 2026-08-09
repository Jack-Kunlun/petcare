import console from "node:console";
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

import { FULL_TYPECHECK_PROJECTS, classifyStagedPaths } from "./commit-scope.mjs";

const root = resolve(import.meta.dirname, "..");

const STYLE_PROJECTS = Object.freeze({
  admin: "@petcare/admin",
  miniapp: "@petcare/miniapp",
});

function runCommand(label, executable, args, cwd = root) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: "inherit",
    });

    child.once("error", (error) => {
      reject(new Error(`${label} 无法启动: ${error.message}`, { cause: error }));
    });
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} 被信号 ${signal} 中断`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${label} 失败，退出码为 ${code ?? 1}`));
        return;
      }

      resolveCommand();
    });
  });
}

function runPnpm(label, args) {
  if (process.platform === "win32") {
    const command = `corepack pnpm ${args.join(" ")}`;
    return runCommand(label, process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command]);
  }

  return runCommand(label, "corepack", ["pnpm", ...args]);
}

function readStagedPaths() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { cwd: root, encoding: "buffer" },
  );

  return output.toString("utf8").split("\0").filter(Boolean);
}

function createFilterArguments(selectors) {
  return selectors.flatMap((selector) => ["--filter", selector]);
}

async function runTypechecks(scope) {
  const selectors = scope.fullTypecheck ? FULL_TYPECHECK_PROJECTS : scope.typecheckSelectors;

  if (selectors.length === 0) return;

  await runPnpm("类型检查", [
    ...createFilterArguments(selectors),
    "--if-present",
    "run",
    "typecheck",
  ]);
}

async function runStyleChecks(styleScopes) {
  for (const styleScope of styleScopes) {
    const project = STYLE_PROJECTS[styleScope];
    await runPnpm(`${project} 样式检查`, ["--filter", project, "run", "lint:styles"]);
  }
}

async function main() {
  const scope = classifyStagedPaths(readStagedPaths());
  await runTypechecks(scope);
  await runStyleChecks(scope.styleScopes);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
