import type { AdminUserListQuery, AdminUserListResponse } from "@petcare/shared-types";
import { apiClient } from "./auth";

/** 按筛选条件查询后台用户分页列表。 */
export async function fetchAdminUsers(params: AdminUserListQuery): Promise<AdminUserListResponse> {
  const response = await apiClient.get<AdminUserListResponse>("/admin/users", { params });

  return response.data;
}
