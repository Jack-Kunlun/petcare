import type { AdminSettlementSummary } from "@petcare/shared-types";
import { apiClient } from "./auth";

/** Reads the protected aggregate settlement projection for PC operations. */
export async function fetchAdminSettlementSummary(): Promise<AdminSettlementSummary> {
  return (await apiClient.get<AdminSettlementSummary>("/admin/settlement/summary")).data;
}
