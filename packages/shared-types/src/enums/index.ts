// packages/shared-types/src/enums/index.ts

/**
 * 用户角色枚举
 */
export enum UserRole {
  PET_OWNER = "pet_owner", // 宠物主人
  SERVICE_PROVIDER = "service_provider", // 服务提供者
  ADMIN = "admin", // 管理员
}

/**
 * 用户状态枚举
 */
export enum UserStatus {
  ACTIVE = "active", // 正常
  FROZEN = "frozen", // 冻结
  DELETED = "deleted", // 已删除
}

/**
 * 权限类型枚举
 */
export enum PermissionType {
  MENU = "menu", // 菜单权限
  BUTTON = "button", // 按钮权限
  API = "api", // API权限
}
