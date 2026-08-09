import console from "node:console";
import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

import {
  classifyStagedPaths,
  createCommitCheckPlan,
  createPnpmInvocation,
} from "./commit-scope.mjs";

const root = resolve(import.meta.dirname, "..");

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
  const invocation = createPnpmInvocation(args, process.platform, process.env.ComSpec);

  return runCommand(label, invocation.executable, invocation.args);
}

function readStagedPaths() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { cwd: root, encoding: "buffer" },
  );

  return output.toString("utf8").split("\0").filter(Boolean);
}

async function runTypechecks(typecheck) {
  if (!typecheck) return;

  await runPnpm("Typecheck", typecheck.args);
}

async function runStyleChecks(styles) {
  for (const styleCheck of styles) {
    await runPnpm(`${styleCheck.project} style check`, styleCheck.args);
  }
}

function logPlan(plan) {
  if (plan.typecheck?.kind === "full") {
    console.log(
      `Commit check full scope (root configuration): ${plan.typecheck.selectors.join(", ")}`,
    );
  } else if (plan.typecheck) {
    console.log(`Commit check affected selectors: ${plan.typecheck.selectors.join(", ")}`);
  } else {
    console.log("Commit check empty scope: no affected workspaces; skipping checks.");
  }

  console.log(
    `Commit check style scopes: ${plan.styles.map(({ scope }) => scope).join(", ") || "none"}`,
  );
}

async function main() {
  const scope = classifyStagedPaths(readStagedPaths());
  const plan = createCommitCheckPlan(scope);

  logPlan(plan);
  await runTypechecks(plan.typecheck);
  await runStyleChecks(plan.styles);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
