import type {
  AdminUserListItem,
  ReplaceRbacRoleUsersRequest,
  RbacRoleDetail,
} from "@petcare/shared-types";

/**
 * Replaces a role's administrator associations unless the role is protected as a system role.
 *
 * The API callback is injected so the role-system guard can be tested without making a request.
 */
export async function replaceRbacRoleUsersForRole(
  role: Pick<RbacRoleDetail, "isSystem">,
  roleId: string,
  userIds: readonly string[],
  replaceUsers: (
    roleId: string,
    request: ReplaceRbacRoleUsersRequest,
  ) => Promise<AdminUserListItem[]>,
): Promise<AdminUserListItem[] | undefined> {
  if (role.isSystem) {
    return undefined;
  }

  return replaceUsers(roleId, { userIds: [...userIds] });
}
