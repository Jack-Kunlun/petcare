import type { AdminOrderStatus, AdminServiceType, AdminUserListItem } from "./admin";
import type { PaginatedResponse } from "./response";

/** 内容管理帖子状态。 */
export const ADMIN_CONTENT_POST_STATUS = {
  /** 帖子已经公开展示。 */
  PUBLISHED: "published",
  /** 帖子尚未公开展示。 */
  DRAFT: "draft",
  /** 帖子已被删除，不再对用户展示。 */
  DELETED: "deleted",
} as const;

/** 内容管理帖子状态类型。 */
export type AdminContentPostStatus =
  (typeof ADMIN_CONTENT_POST_STATUS)[keyof typeof ADMIN_CONTENT_POST_STATUS];

/** 课堂文章状态。 */
export const ADMIN_CLASSROOM_ARTICLE_STATUS = {
  /** 文章仍在编辑中。 */
  DRAFT: "draft",
  /** 文章已经发布。 */
  PUBLISHED: "published",
  /** 文章已下线。 */
  OFFLINE: "offline",
} as const;

/** 课堂文章状态类型。 */
export type AdminClassroomArticleStatus =
  (typeof ADMIN_CLASSROOM_ARTICLE_STATUS)[keyof typeof ADMIN_CLASSROOM_ARTICLE_STATUS];

/** 内容列表中的作者摘要。 */
export type AdminContentAuthorSummary = Pick<
  AdminUserListItem,
  "id" | "phone" | "username" | "nickname" | "avatar"
>;

/** 后台悬赏列表中的宠物摘要。 */
export interface AdminContentPetSummary {
  /** 宠物唯一标识。 */
  id: string;
  /** 宠物名称。 */
  name: string;
  /** 宠物品种。 */
  breed: string;
}

/** 后台悬赏管理列表项。金额单位为元。 */
export interface AdminContentRewardListItem {
  /** 悬赏订单唯一标识。 */
  id: string;
  /** 服务类型。 */
  serviceType: AdminServiceType;
  /** 发布悬赏的用户。 */
  owner: AdminContentAuthorSummary;
  /** 悬赏关联宠物。 */
  pet: AdminContentPetSummary;
  /** 悬赏金额，单位为元。 */
  rewardAmount: number;
  /** 订单当前履约状态。 */
  status: AdminOrderStatus;
  /** 计划服务时间，ISO 8601 格式。 */
  serviceTime: string;
  /** 悬赏创建时间，ISO 8601 格式。 */
  createdAt: string;
}

/** 后台悬赏列表查询参数。 */
export interface AdminContentRewardListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 100。 */
  pageSize: number;
  /** 匹配订单号、发布人手机号、昵称或宠物名称的关键词。 */
  keyword?: string;
  /** 服务类型筛选。 */
  serviceType?: AdminServiceType;
  /** 履约状态筛选。 */
  status?: AdminOrderStatus;
}

/** 后台悬赏列表响应。 */
export type AdminContentRewardListResponse = PaginatedResponse<AdminContentRewardListItem>;

/** 后台帖子列表项。 */
export interface AdminContentPostListItem {
  /** 帖子唯一标识。 */
  id: string;
  /** 帖子作者。 */
  author: AdminContentAuthorSummary;
  /** 帖子正文的列表摘要。 */
  contentExcerpt: string;
  /** 帖子媒体数量。 */
  mediaCount: number;
  /** 获赞数量。 */
  likesCount: number;
  /** 评论数量。 */
  commentsCount: number;
  /** 分享数量。 */
  sharesCount: number;
  /** 帖子状态。 */
  status: AdminContentPostStatus;
  /** 帖子创建时间，ISO 8601 格式。 */
  createdAt: string;
  /** 帖子最后更新时间，ISO 8601 格式。 */
  updatedAt: string;
}

/** 后台帖子列表查询参数。 */
export interface AdminContentPostListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 100。 */
  pageSize: number;
  /** 匹配帖子 ID、作者手机号、昵称或正文的关键词。 */
  keyword?: string;
  /** 帖子状态筛选。 */
  status?: AdminContentPostStatus;
}

/** 后台帖子列表响应。 */
export type AdminContentPostListResponse = PaginatedResponse<AdminContentPostListItem>;

/** 后台课堂文章列表项。 */
export interface AdminClassroomArticleListItem {
  /** 课堂文章唯一标识。 */
  id: string;
  /** 文章标题。 */
  title: string;
  /** 文章摘要。 */
  summary: string;
  /** 封面图片地址。 */
  coverUrl: string | null;
  /** 文章状态。 */
  status: AdminClassroomArticleStatus;
  /** 文章作者，可为空。 */
  author: AdminContentAuthorSummary | null;
  /** 发布时间，未发布时为 null。 */
  publishedAt: string | null;
  /** 创建时间，ISO 8601 格式。 */
  createdAt: string;
  /** 最后更新时间，ISO 8601 格式。 */
  updatedAt: string;
}

/** 后台课堂文章列表查询参数。 */
export interface AdminClassroomArticleListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 100。 */
  pageSize: number;
  /** 匹配文章标题、摘要或正文的关键词。 */
  keyword?: string;
  /** 文章状态筛选。 */
  status?: AdminClassroomArticleStatus;
}

/** 后台课堂文章列表响应。 */
export type AdminClassroomArticleListResponse = PaginatedResponse<AdminClassroomArticleListItem>;
