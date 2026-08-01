import { EventEmitter } from "node:events";
import { runWithProcessSignalHandling } from "../../apps/admin/e2e/run-e2e.mjs";

const runtime = new EventEmitter();
const forwardSignal = (signal) => runtime.emit(signal);

process.on("message", forwardSignal);

const exitCode = await runWithProcessSignalHandling(async (signal) => {
  const interrupted = signal.aborted
    ? Promise.resolve()
    : new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  await new Promise((resolve, reject) => {
    process.send?.("ready", (error) => (error ? reject(error) : resolve()));
  });
  await interrupted;
  await new Promise((resolve, reject) => {
    process.send?.("close", (error) => (error ? reject(error) : resolve()));
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await new Promise((resolve, reject) => {
    process.send?.("drop", (error) => (error ? reject(error) : resolve()));
  });
  throw signal.reason;
}, runtime);

process.off("message", forwardSignal);
process.disconnect();
process.exitCode = exitCode;
