import type {
  AdminAccountProfile,
  AdminAvatarResponse,
  UpdateAdminAccountPasswordRequest,
  UpdateAdminAccountProfileRequest,
} from "@petcare/shared-types";
import { apiClient } from "./auth";

/** 获取当前管理员的个人资料。 */
export async function getAdminAccountProfile(): Promise<AdminAccountProfile> {
  const response = await apiClient.get<AdminAccountProfile>("/admin/account/profile");

  return response.data;
}

/** 更新当前管理员的个人资料。 */
export async function updateAdminAccountProfile(
  request: UpdateAdminAccountProfileRequest,
): Promise<void> {
  const response = await apiClient.patch<void>("/admin/account/profile", request);

  return response.data;
}

/** 上传当前管理员的头像。 */
export async function uploadAdminAvatar(file: File): Promise<AdminAvatarResponse> {
  const formData = new FormData();

  formData.append("file", file);

  const response = await apiClient.put<AdminAvatarResponse>("/admin/account/avatar", formData);

  return response.data;
}

/** 删除当前管理员的头像。 */
export async function deleteAdminAvatar(): Promise<void> {
  await apiClient.delete<void>("/admin/account/avatar");
}

/** 修改当前管理员的密码。 */
export async function changeAdminPassword(
  request: UpdateAdminAccountPasswordRequest,
): Promise<void> {
  await apiClient.put<void>("/admin/account/password", request);
}
