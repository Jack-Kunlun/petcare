import type { DemoScenario, MiniappDemoAction } from "@petcare/shared-types";
import { authorizedRequest } from "../state/session";

/** Starts a short-lived process demonstration without creating business records. */
export function createDemo(): Promise<DemoScenario> {
  return authorizedRequest("/demo", { method: "POST" });
}

/** Reads the same demonstration by code on the Miniapp experience version. */
export function getDemo(code: string): Promise<DemoScenario> {
  return authorizedRequest(`/demo/${encodeURIComponent(code)}`);
}

/** Advances a Miniapp-only demonstration step without payment or settlement calls. */
export function advanceDemo(code: string, action: MiniappDemoAction): Promise<DemoScenario> {
  return authorizedRequest(`/demo/${encodeURIComponent(code)}/${action}`, { method: "POST" });
}
