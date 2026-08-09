import console from "node:console";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");

const typecheckProjects = [
  "@petcare/admin",
  "@petcare/miniapp",
  "@petcare/uniapp",
  "@petcare/server",
  "@petcare/api-client",
  "@petcare/shared-types",
  "@petcare/shared-utils",
];

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

async function runTypechecks() {
  for (const project of typecheckProjects) {
    await runPnpm(`${project} 类型检查`, ["--filter", project, "run", "typecheck"]);
  }
}

async function main() {
  await runTypechecks();
  await runPnpm("Lint 与样式错误检查", ["lint"]);
  await runPnpm("E2E 测试", ["test:e2e"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
