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
