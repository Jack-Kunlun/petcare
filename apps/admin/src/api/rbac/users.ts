import type { AdminUserListItem, ReplaceRbacRoleUsersRequest } from "@petcare/shared-types";
import { apiClient } from "../auth";

const RBAC_ROLES_PATH = "/admin/rbac/roles";

/** Retrieves the complete list of administrators assigned to a role. */
export async function fetchRbacRoleUsers(roleId: string): Promise<AdminUserListItem[]> {
  const response = await apiClient.get<AdminUserListItem[]>(`${RBAC_ROLES_PATH}/${roleId}/users`);

  return response.data;
}

/** Atomically replaces the complete set of administrators assigned to a role. */
export async function replaceRbacRoleUsers(
  roleId: string,
  request: ReplaceRbacRoleUsersRequest,
): Promise<AdminUserListItem[]> {
  const response = await apiClient.put<AdminUserListItem[]>(
    `${RBAC_ROLES_PATH}/${roleId}/users`,
    request,
  );

  return response.data;
}
