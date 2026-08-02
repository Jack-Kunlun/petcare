import type { RbacPermissionDefinition } from "../rbac";
import type { PaginatedResponse } from "./response";

/** Response containing the active code-defined permission catalog. */
export interface RbacCatalogResponse {
  /** Version identifier for cache invalidation. */
  version: string;
  /** All menu, button, and API permission definitions. */
  permissions: RbacPermissionDefinition[];
}

/** Summary information for an administrative role. */
export interface RbacRoleListItem {
  /** Role identifier. */
  id: string;
  /** Unique role name. */
  roleName: string;
  /** Optional explanation of the role's responsibility. */
  description: string | null;
  /** Whether the role is protected as a system role. */
  isSystem: boolean;
  /** Whether administrators assigned to the role may use it. */
  isActive: boolean;
  /** Number of permissions currently assigned to the role. */
  permissionCount: number;
  /** Number of administrators currently assigned to the role. */
  userCount: number;
  /** ISO-8601 timestamp of the most recent role change. */
  updatedAt: string;
}

/** Paginated administrative role list response. */
export type RbacRoleListResponse = PaginatedResponse<RbacRoleListItem>;

/** Full administrative role information. */
export interface RbacRoleDetail extends RbacRoleListItem {
  /** Effective permission codes assigned to the role. */
  permissionCodes: string[];
  /** Administrator identifiers assigned to the role. */
  userIds: string[];
}

/** Payload for creating a normal administrative role. */
export interface CreateRbacRoleRequest {
  /** Unique role name. */
  roleName: string;
  /** Optional explanation of the role's responsibility. */
  description?: string;
}

/** Payload for updating a normal administrative role. */
export interface UpdateRbacRoleRequest {
  /** Replacement unique role name. */
  roleName?: string;
  /** Replacement role description. */
  description?: string;
  /** Replacement active status. */
  isActive?: boolean;
}

/** Payload that atomically replaces a role's editable permissions. */
export interface ReplaceRbacRolePermissionsRequest {
  /** Menu and button permission codes selected by the administrator. */
  permissionCodes: string[];
}

/** Payload that atomically replaces a role's assigned administrators. */
export interface ReplaceRbacRoleUsersRequest {
  /** Administrator identifiers to associate with the role. */
  userIds: string[];
}
