import type { AdminBountyOrderListResponse, BountyListQuery } from "@petcare/shared-types";
import { apiClient } from "./auth";

/** Reads the protected PC reward-order operations list. */
export async function fetchAdminBountyOrders(
  query: BountyListQuery,
): Promise<AdminBountyOrderListResponse> {
  return (
    await apiClient.get<AdminBountyOrderListResponse>("/admin/bounties/orders", { params: query })
  ).data;
}
