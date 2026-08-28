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

/** 拉黑用户并立即使其现有会话失效。 */
export async function banAdminUser(id: string): Promise<AdminUserDetail> {
  const response = await apiClient.post<AdminUserDetail>(`/admin/users/${id}/ban`);

  return response.data;
}

/** 恢复已拉黑用户，允许其重新登录。 */
export async function restoreAdminUser(id: string): Promise<AdminUserDetail> {
  const response = await apiClient.post<AdminUserDetail>(`/admin/users/${id}/restore`);

  return response.data;
}
