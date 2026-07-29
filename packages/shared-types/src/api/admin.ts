import type { PaginatedResponse } from "./response";

/** 后台用户类型的可选值。 */
export const ADMIN_USER_TYPE = {
  /** 普通宠物家长，可发布或购买宠物服务。 */
  PET_OWNER: "pet_owner",
  /** 宠托服务者，可承接平台或悬赏订单。 */
  PROVIDER: "provider",
} as const;

/** 后台用户类型。 */
export type AdminUserType = (typeof ADMIN_USER_TYPE)[keyof typeof ADMIN_USER_TYPE];

/** 后台用户状态的可选值。 */
export const ADMIN_USER_STATUS = {
  /** 账号可正常使用。 */
  ACTIVE: "active",
  /** 账号尚未激活。 */
  INACTIVE: "inactive",
  /** 账号已被平台禁止使用。 */
  BANNED: "banned",
} as const;

/** 后台用户状态。 */
export type AdminUserStatus = (typeof ADMIN_USER_STATUS)[keyof typeof ADMIN_USER_STATUS];

/** 宠托师认证摘要。 */
export interface AdminProviderSummary {
  /** 是否已完成身份证实名认证。 */
  idCardVerified: boolean;
  /** 是否已通过平台培训。 */
  trainingPassed: boolean;
  /** 是否已取得平台宠托师认证。 */
  certifiedSitter: boolean;
}

/** 后台用户列表中的单个用户。 */
export interface AdminUserListItem {
  /** 用户唯一标识。 */
  id: string;
  /** 登录及联系手机号。 */
  phone: string;
  /** 可用于密码登录的账号；未设置时为 null。 */
  username: string | null;
  /** 用户展示昵称。 */
  nickname: string;
  /** 用户头像地址；未设置时为 null。 */
  avatar: string | null;
  /** 用户业务类型。 */
  userType: AdminUserType;
  /** 用户账号状态。 */
  status: AdminUserStatus;
  /** ISO 8601 格式的创建时间。 */
  createdAt: string;
  /** ISO 8601 格式的最后更新时间。 */
  updatedAt: string;
  /** 宠托师认证摘要；普通宠物家长为 null。 */
  provider: AdminProviderSummary | null;
}

/** 后台用户分页查询参数。 */
export interface AdminUserListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 100。 */
  pageSize: number;
  /** 匹配手机号、账号或昵称的可选关键词。 */
  keyword?: string;
  /** 可选的用户类型筛选。 */
  userType?: AdminUserType;
  /** 可选的账号状态筛选。 */
  status?: AdminUserStatus;
}

/** 后台用户分页响应。 */
export type AdminUserListResponse = PaginatedResponse<AdminUserListItem>;

/** 后台订单类型的可选值。 */
export const ADMIN_ORDER_TYPE = {
  /** 用户发布并自主定价的悬赏订单。 */
  REWARD: "reward",
  /** 平台统一定价和履约的订单。 */
  PLATFORM: "platform",
} as const;

/** 后台订单类型。 */
export type AdminOrderType = (typeof ADMIN_ORDER_TYPE)[keyof typeof ADMIN_ORDER_TYPE];

/** 后台服务类型的可选值。 */
export const ADMIN_SERVICE_TYPE = {
  /** 上门添加食物、饮水并完成基础照护。 */
  FEEDING: "feeding",
  /** 到店或上门遛宠服务。 */
  WALKING: "walking",
  /** 与宠物互动和陪玩服务。 */
  PLAYING: "playing",
} as const;

/** 后台服务类型。 */
export type AdminServiceType = (typeof ADMIN_SERVICE_TYPE)[keyof typeof ADMIN_SERVICE_TYPE];

/** 后台订单状态的可选值。 */
export const ADMIN_ORDER_STATUS = {
  /** 订单已创建，等待确认。 */
  PENDING_CONFIRM: "pending_confirm",
  /** 订单已确认，等待开始服务。 */
  CONFIRMED: "confirmed",
  /** 服务者正在履约。 */
  IN_PROGRESS: "in_progress",
  /** 服务已经完成。 */
  COMPLETED: "completed",
  /** 订单已经取消。 */
  CANCELLED: "cancelled",
} as const;

/** 后台订单状态。 */
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUS)[keyof typeof ADMIN_ORDER_STATUS];

/** 订单关联用户的公开摘要。 */
export interface AdminOrderUserSummary {
  /** 用户唯一标识。 */
  id: string;
  /** 用户手机号。 */
  phone: string;
  /** 用户账号；未设置时为 null。 */
  username: string | null;
  /** 用户展示昵称。 */
  nickname: string;
  /** 用户头像地址；未设置时为 null。 */
  avatar: string | null;
  /** 用户业务类型。 */
  userType: string;
  /** 用户账号状态。 */
  status: string;
}

/** 订单关联宠物的摘要。 */
export interface AdminOrderPetSummary {
  /** 宠物唯一标识。 */
  id: string;
  /** 宠物名称。 */
  name: string;
  /** 宠物品种。 */
  breed: string;
}

/** 后台订单列表中的单个订单。 */
export interface AdminOrderListItem {
  /** 订单唯一标识。 */
  id: string;
  /** 订单业务类型。 */
  orderType: AdminOrderType;
  /** 服务业务类型。 */
  serviceType: AdminServiceType;
  /** 下单用户唯一标识。 */
  ownerId: string;
  /** 服务者唯一标识；尚未分配时为 null。 */
  providerId: string | null;
  /** 服务宠物唯一标识。 */
  petId: string;
  /** ISO 8601 格式的预约服务时间。 */
  serviceTime: string;
  /** 服务地址。 */
  address: string;
  /** 订单金额，单位为元。 */
  amount: number;
  /** 当前履约状态。 */
  status: AdminOrderStatus;
  /** 用户备注；未填写时为 null。 */
  remark: string | null;
  /** ISO 8601 格式的完成时间；未完成时为 null。 */
  completedAt: string | null;
  /** ISO 8601 格式的创建时间。 */
  createdAt: string;
  /** ISO 8601 格式的最后更新时间。 */
  updatedAt: string;
  /** 下单用户摘要。 */
  owner: AdminOrderUserSummary;
  /** 服务者摘要；尚未分配时为 null。 */
  provider: AdminOrderUserSummary | null;
  /** 服务宠物摘要。 */
  pet: AdminOrderPetSummary;
}

/** 后台订单分页查询参数。 */
export interface AdminOrderListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 100。 */
  pageSize: number;
  /** 匹配订单号、用户或宠物的可选关键词。 */
  keyword?: string;
  /** 可选的订单类型筛选。 */
  orderType?: AdminOrderType;
  /** 可选的服务类型筛选。 */
  serviceType?: AdminServiceType;
  /** 可选的订单状态筛选。 */
  status?: AdminOrderStatus;
}

/** 后台订单分页响应。 */
export type AdminOrderListResponse = PaginatedResponse<AdminOrderListItem>;
