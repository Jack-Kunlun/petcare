import type {
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserListResponse,
} from "@petcare/shared-types";
import { apiClient } from "./auth";

/** 按筛选条件查询后台用户分页列表。 */
export async function fetchAdminUsers(params: AdminUserListQuery): Promise<AdminUserListResponse> {
  const response = await apiClient.get<AdminUserListResponse>("/admin/users", { params });

  return response.data;
}

/** 查询单个后台用户详情。 */
export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  const response = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`);

  return response.data;
}
