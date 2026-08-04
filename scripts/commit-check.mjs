import console from "node:console";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");

const typecheckProjects = [
  { name: "@petcare/admin", directory: "apps/admin", project: "tsconfig.json" },
  { name: "@petcare/miniapp", directory: "apps/miniapp", project: "tsconfig.json" },
  { name: "@petcare/server", directory: "apps/server", project: "tsconfig.build.json" },
  { name: "@petcare/api-client", directory: "packages/api-client", project: "tsconfig.json" },
  { name: "@petcare/shared-types", directory: "packages/shared-types", project: "tsconfig.json" },
  { name: "@petcare/shared-utils", directory: "packages/shared-utils", project: "tsconfig.json" },
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
    const directory = resolve(root, project.directory);
    const typescriptCli = resolve(directory, "node_modules/typescript/bin/tsc");

    await runCommand(
      `${project.name} 类型检查`,
      process.execPath,
      [
        typescriptCli,
        "--noEmit",
        "--project",
        resolve(directory, project.project),
        "--pretty",
        "false",
      ],
      directory,
    );
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
