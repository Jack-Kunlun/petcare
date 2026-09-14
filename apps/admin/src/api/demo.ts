import type { AdminDemoAction, DemoScenario } from "@petcare/shared-types";
import { apiClient } from "./auth";

/** Reads one synthetic scenario by the code shown in the Miniapp experience version. */
export async function fetchDemo(code: string): Promise<DemoScenario> {
  return (await apiClient.get<DemoScenario>(`/admin/demo/${encodeURIComponent(code)}`)).data;
}

/** Advances only the two PC administrator steps of the synthetic flow. */
export async function advanceDemo(code: string, action: AdminDemoAction): Promise<DemoScenario> {
  return (await apiClient.post<DemoScenario>(`/admin/demo/${encodeURIComponent(code)}/${action}`))
    .data;
}
