import type { AdminOrderStatus, AdminServiceType, AdminUserListItem } from "./admin";
import type { PaginatedResponse } from "./response";
import type { WebsitePublicMediaAsset } from "./website-content";

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

/** 课堂文章使用的受控分类。 */
export const CLASSROOM_ARTICLE_CATEGORY = {
  /** 日常饮食、营养和换粮知识。 */
  FEEDING_GUIDE: "feeding_guide",
  /** 体检、护理和健康观察知识。 */
  HEALTH_MANAGEMENT: "health_management",
  /** 习惯培养和行为纠正知识。 */
  BEHAVIOR_TRAINING: "behavior_training",
  /** 常见疾病风险识别和预防知识。 */
  DISEASE_PREVENTION: "disease_prevention",
} as const;

/** 课堂文章受控分类类型。 */
export type ClassroomArticleCategory =
  (typeof CLASSROOM_ARTICLE_CATEGORY)[keyof typeof CLASSROOM_ARTICLE_CATEGORY];

/** 课堂文章分类的统一中文显示名称。 */
export const CLASSROOM_ARTICLE_CATEGORY_LABELS: Readonly<Record<ClassroomArticleCategory, string>> =
  {
    /** 喂养类文章的显示名称。 */
    feeding_guide: "喂养指南",
    /** 健康类文章的显示名称。 */
    health_management: "健康管理",
    /** 行为类文章的显示名称。 */
    behavior_training: "行为训练",
    /** 疾病预防类文章的显示名称。 */
    disease_prevention: "疾病预防",
  };

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
  /** 受控文章分类；历史文章尚未分类时为 null。 */
  category: ClassroomArticleCategory | null;
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
  /** 服务端生成的官网文章地址。 */
  publicUrl: string;
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

/** 后台课堂文章完整详情。 */
export interface AdminClassroomArticleDetail extends AdminClassroomArticleListItem {
  /** 已由服务端清洗、可加载到文章编辑器的 HTML 正文。 */
  bodyHtml: string;
}

/** 新建课堂文章的请求内容。 */
export interface CreateAdminClassroomArticleRequest {
  /** 运营人员选择的受控文章分类。 */
  category: ClassroomArticleCategory;
  /** 去除首尾空白后的文章标题，长度为 1 至 120 个字符。 */
  title: string;
  /** 去除首尾空白后的文章摘要，长度为 1 至 500 个字符。 */
  summary: string;
  /** 不可信的编辑器 HTML；服务端持久化前会清洗并校验。 */
  bodyHtml: string;
  /** 可用的受管理封面素材；为 null 时不设置封面。 */
  coverAssetId?: string | null;
}

/** 更新课堂文章的请求内容。 */
export interface UpdateAdminClassroomArticleRequest extends Omit<
  CreateAdminClassroomArticleRequest,
  "coverAssetId"
> {
  /** 省略时保留封面，null 时清除封面，传入素材 ID 时替换封面。 */
  coverAssetId?: string | null;
  /** 最后一次读取到的文章更新时间，用于乐观并发控制。 */
  expectedUpdatedAt: string;
}

/** 修改课堂文章发布状态的请求内容。 */
export interface AdminClassroomArticleStateRequest {
  /** 最后一次读取到的文章更新时间，用于乐观并发控制。 */
  expectedUpdatedAt: string;
}

/** 上传课堂文章图片后返回的可公开使用受管理素材。 */
export type UploadAdminClassroomArticleMediaResponse = WebsitePublicMediaAsset;

/** Public article-author display data that is safe for website visitors. */
export interface PublicClassroomArticleAuthor {
  /** Display name selected from the article author's public profile fields. */
  displayName: string;
  /** Optional public avatar URL for the article author. */
  avatar: string | null;
}

/** Public classroom article summary for the official website. */
export interface PublicClassroomArticleListItem {
  /** Stable route value; the first release uses the article ID directly. */
  slug: string;
  /** Controlled article category, or null for a legacy article awaiting classification. */
  category: ClassroomArticleCategory | null;
  /** Public article title. */
  title: string;
  /** Public article summary. */
  summary: string;
  /** Optional public cover image URL. */
  coverUrl: string | null;
  /** Optional public author display data. */
  author: PublicClassroomArticleAuthor | null;
  /** Publication timestamp in ISO 8601 format when the source article records one. */
  publishedAt: string | null;
}

/** Public classroom article detail for the official website. */
export interface PublicClassroomArticleDetail extends PublicClassroomArticleListItem {
  /** Server-cleaned article HTML safe for the official website renderer. */
  bodyHtml: string;
}

/** Pagination query accepted by the public classroom article list. */
export interface PublicClassroomArticleListQuery {
  /** One-based result page. */
  page: number;
  /** Number of articles per page, from 1 through 100. */
  pageSize: number;
  /** Optional title, summary, or body search text. */
  keyword?: string;
  /** Optional exact controlled category filter. */
  category?: ClassroomArticleCategory;
}

/** Public paginated classroom article list response. */
export type PublicClassroomArticleListResponse = PaginatedResponse<PublicClassroomArticleListItem>;
