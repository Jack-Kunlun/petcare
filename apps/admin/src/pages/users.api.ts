import type { PaginatedResponse } from "@petcare/shared-types";
import { apiClient } from "../auth/auth.api";

export type AdminUserType = "pet_owner" | "provider";
export type AdminUserStatus = "active" | "inactive" | "banned";

export interface AdminProviderSummary {
  idCardVerified: boolean;
  trainingPassed: boolean;
  certifiedSitter: boolean;
}

export interface AdminUserListItem {
  id: string;
  phone: string;
  username: string | null;
  nickname: string;
  avatar: string | null;
  userType: AdminUserType;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
  provider: AdminProviderSummary | null;
}

export interface AdminUserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  userType?: AdminUserType;
  status?: AdminUserStatus;
}

export async function fetchAdminUsers(
  params: AdminUserListParams,
): Promise<PaginatedResponse<AdminUserListItem>> {
  const response = await apiClient.get<PaginatedResponse<AdminUserListItem>>("/admin/users", {
    params,
  });

  return response.data;
}
