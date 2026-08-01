import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDirectory = path.dirname(fileURLToPath(import.meta.url));
const listener = fork(path.join(fixtureDirectory, "admin-e2e-tree-listener.mjs"), {
  detached: process.platform === "win32",
  silent: true,
});

listener.once("message", (message) => {
  process.send?.({
    type: "tree-ready",
    rootPid: process.pid,
    descendantPid: message.pid,
    port: message.port,
  });
});
