import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";

/** Creates an error for a permission code that is absent from the active catalog. */
export function rbacUnknownPermission(code: string): ApiException {
  return new ApiException(
    "RBAC_UNKNOWN_PERMISSION",
    `权限代码不存在于当前目录：${code}`,
    HttpStatus.BAD_REQUEST,
  );
}

/** Creates an error for an API permission supplied by the role editing UI. */
export function rbacApiPermissionNotAssignable(code: string): ApiException {
  return new ApiException(
    "RBAC_API_PERMISSION_NOT_ASSIGNABLE",
    `API 权限不能由角色编辑界面直接授权：${code}`,
    HttpStatus.BAD_REQUEST,
  );
}

/** Creates an error when the code-defined catalog violates its structural rules. */
export function rbacInvalidPermissionParent(code: string): ApiException {
  return new ApiException(
    "RBAC_INVALID_PERMISSION_PARENT",
    `权限目录中的父级关系无效：${code}`,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/** Creates an error when the code-defined catalog contains duplicate permission codes. */
export function rbacDuplicatePermissionCode(code: string): ApiException {
  return new ApiException(
    "RBAC_DUPLICATE_PERMISSION_CODE",
    `权限目录包含重复的权限代码：${code}`,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/** Creates an error when a UI permission references a non-API implied permission. */
export function rbacInvalidImpliedApiCode(code: string): ApiException {
  return new ApiException(
    "RBAC_INVALID_IMPLIED_API_CODE",
    `权限目录中的隐含 API 权限无效：${code}`,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

/** Creates an error when a requested role does not exist. */
export function rbacRoleNotFound(roleId: string): ApiException {
  return new ApiException("RBAC_ROLE_NOT_FOUND", `角色不存在：${roleId}`, HttpStatus.NOT_FOUND);
}

/** Creates an error when a role name is already assigned. */
export function rbacRoleNameConflict(roleName: string): ApiException {
  return new ApiException(
    "RBAC_ROLE_NAME_CONFLICT",
    `角色名称已存在：${roleName}`,
    HttpStatus.CONFLICT,
  );
}

/** Creates an error when a protected system role would be modified. */
export function rbacSystemRoleProtected(roleId: string): ApiException {
  return new ApiException(
    "RBAC_SYSTEM_ROLE_PROTECTED",
    `系统角色不可修改或删除：${roleId}`,
    HttpStatus.CONFLICT,
  );
}

/** Creates an error when deleting a role that is still assigned to users. */
export function rbacRoleHasAssignedUsers(roleId: string): ApiException {
  return new ApiException(
    "RBAC_ROLE_HAS_ASSIGNED_USERS",
    `角色仍有关联用户，无法删除：${roleId}`,
    HttpStatus.CONFLICT,
  );
}

/** Creates an error when a requested user does not exist. */
export function rbacUserNotFound(userId: string): ApiException {
  return new ApiException("RBAC_USER_NOT_FOUND", `用户不存在：${userId}`, HttpStatus.NOT_FOUND);
}

/** Creates an error when catalog permissions have not yet been synchronized to the database. */
export function rbacPermissionNotSynchronized(code: string): ApiException {
  return new ApiException(
    "RBAC_PERMISSION_NOT_SYNCHRONIZED",
    `权限目录尚未同步到数据库：${code}`,
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
