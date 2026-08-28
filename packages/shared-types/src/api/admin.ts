import type { PaginatedResponse } from "./response";

/** 后台用户类型的可选值。 */
export const ADMIN_USER_TYPE = {
  /** 当前个人版使用的宠物账户类型。 */
  PET_OWNER: "pet_owner",
  /** 历史服务者账户类型，仅用于兼容既有数据。 */
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

/** 后台用户列表中的单个用户。 */
export interface AdminUserListItem {
  /** 用户唯一标识。 */
  id: string;
  /** Verified phone number, or null for a Miniapp account that has not completed its profile. */
  phone: string | null;
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
}

/** 后台用户详情中可展示的非敏感个人资料。 */
export interface AdminUserDetailProfile {
  /** 用户自述；未填写时为 null。 */
  bio: string | null;
}

/** 后台用户详情中的当前使用概况。 */
export interface AdminUserActivitySummary {
  /** 当前关联的宠物档案数量。 */
  petCount: number;
  /** 当前创建的社区帖子数量。 */
  postCount: number;
  /** 当前创建的评论数量。 */
  commentCount: number;
  /** 当前收藏的内容数量。 */
  favoriteCount: number;
}

/** 后台用户详情响应。 */
export interface AdminUserDetail extends AdminUserListItem {
  /** 可供后台查看的非敏感个人资料；尚未建立资料时为 null。 */
  profile: AdminUserDetailProfile | null;
  /** 当前使用概况。 */
  activity: AdminUserActivitySummary;
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
