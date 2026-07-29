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
 * 订单类型枚举
 */
export enum OrderType {
  REWARD = "reward", // 悬赏订单
  PLATFORM = "platform", // 平台定价订单
}

/**
 * 订单状态枚举
 */
export enum OrderStatus {
  PENDING_CONFIRM = "pending_confirm", // 待确认
  CONFIRMED = "confirmed", // 已确认
  IN_PROGRESS = "in_progress", // 服务中
  COMPLETED = "completed", // 已完成
  CANCELLED = "cancelled", // 已取消
  DISPUTED = "disputed", // 纠纷中
}

/**
 * 服务类型枚举
 */
export enum ServiceType {
  FEEDING = "feeding", // 上门喂养
  WALKING = "walking", // 遛狗
  PLAYING = "playing", // 陪玩
}

/**
 * 权限类型枚举
 */
export enum PermissionType {
  MENU = "menu", // 菜单权限
  BUTTON = "button", // 按钮权限
  API = "api", // API权限
}
