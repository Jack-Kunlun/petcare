import type {
  CreateRbacRoleRequest,
  RbacRoleDetail,
  RbacRoleListQuery,
  RbacRoleListResponse,
  ReplaceRbacRolePermissionsRequest,
  UpdateRbacRoleRequest,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

const RBAC_ROLES_PATH = "/admin/rbac/roles";

/** Retrieves a page of administrative roles using the shared list contract. */
export async function fetchRbacRoles(query: RbacRoleListQuery): Promise<RbacRoleListResponse> {
  const response = await apiClient.get<RbacRoleListResponse>(RBAC_ROLES_PATH, { params: query });

  return response.data;
}

/** Retrieves one administrative role and its current permission and user assignments. */
export async function fetchRbacRole(roleId: string): Promise<RbacRoleDetail> {
  const response = await apiClient.get<RbacRoleDetail>(`${RBAC_ROLES_PATH}/${roleId}`);

  return response.data;
}

/** Creates an administrative role from the shared request contract. */
export async function createRbacRole(request: CreateRbacRoleRequest): Promise<RbacRoleDetail> {
  const response = await apiClient.post<RbacRoleDetail>(RBAC_ROLES_PATH, request);

  return response.data;
}

/** Updates an administrative role's editable fields. */
export async function updateRbacRole(
  roleId: string,
  request: UpdateRbacRoleRequest,
): Promise<RbacRoleDetail> {
  const response = await apiClient.patch<RbacRoleDetail>(`${RBAC_ROLES_PATH}/${roleId}`, request);

  return response.data;
}

/** Deletes an unassigned, non-system administrative role. */
export async function deleteRbacRole(roleId: string): Promise<void> {
  await apiClient.delete(`${RBAC_ROLES_PATH}/${roleId}`);
}

/** Atomically replaces a role's editable permission codes. */
export async function replaceRbacRolePermissions(
  roleId: string,
  request: ReplaceRbacRolePermissionsRequest,
): Promise<RbacRoleDetail> {
  const response = await apiClient.put<RbacRoleDetail>(
    `${RBAC_ROLES_PATH}/${roleId}/permissions`,
    request,
  );

  return response.data;
}
