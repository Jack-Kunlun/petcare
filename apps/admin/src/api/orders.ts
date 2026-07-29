import type { AdminOrderListQuery, AdminOrderListResponse } from "@petcare/shared-types";
import { apiClient } from "./auth";

/** 按筛选条件查询后台订单分页列表。 */
export async function fetchAdminOrders(
  params: AdminOrderListQuery,
): Promise<AdminOrderListResponse> {
  const response = await apiClient.get<AdminOrderListResponse>("/admin/orders", { params });

  return response.data;
}
