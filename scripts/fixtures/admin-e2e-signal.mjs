import { fork } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { runWithProcessSignalHandling } from "../../apps/admin/e2e/run-e2e.mjs";
import { stopProcess } from "../../apps/admin/e2e/run-e2e.mjs";

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));

const exitCode = await runWithProcessSignalHandling(async (signal) => {
  const treeRoot = fork(path.join(fixtureDirectory, "admin-e2e-tree-root.mjs"), {
    detached: process.platform !== "win32",
    silent: true,
  });
  const interrupted = signal.aborted
    ? Promise.resolve()
    : new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  const [tree] = await once(treeRoot, "message");
  await new Promise((resolve, reject) => {
    process.send?.({ type: "ready", ...tree }, (error) => (error ? reject(error) : resolve()));
  });
  await interrupted;
  await new Promise((resolve, reject) => {
    process.send?.("close", (error) => (error ? reject(error) : resolve()));
  });
  await stopProcess(treeRoot);
  await new Promise((resolve) => setTimeout(resolve, 10));
  await new Promise((resolve, reject) => {
    process.send?.("drop", (error) => (error ? reject(error) : resolve()));
  });
  throw signal.reason;
});

process.disconnect();
process.exitCode = exitCode;
