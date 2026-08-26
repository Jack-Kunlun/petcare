import type { AdminOrderStatus, AdminServiceType, AdminUserListItem } from "./admin";
import type { PaginatedResponse } from "./response";
import type { WebsitePublicMediaAsset } from "./website-content";

/** 内容管理帖子状态。 */
export const ADMIN_CONTENT_POST_STATUS = {
  /** 帖子已提交，等待运营审核。 */
  PENDING: "pending",
  /** 帖子已经公开展示。 */
  PUBLISHED: "published",
  /** 帖子审核未通过，仅作者和管理员可读取原因。 */
  REJECTED: "rejected",
  /** 帖子已由运营下架，不再公开展示。 */
  OFFLINE: "offline",
  /** 帖子已被删除，不再对用户展示。 */
  DELETED: "deleted",
} as const;

/** 内容管理帖子状态类型。 */
export type AdminContentPostStatus =
  (typeof ADMIN_CONTENT_POST_STATUS)[keyof typeof ADMIN_CONTENT_POST_STATUS];

/** 社区帖子生命周期状态。 */
export type CommunityPostStatus = AdminContentPostStatus;

/** Community image lifecycle state before and after post binding. */
export const COMMUNITY_MEDIA_STATUS = {
  /** Media may be bound to one post owned by the uploader. */
  ACTIVE: "active",
  /** Media has been invalidated and cannot be bound to a post. */
  DISCARDED: "discarded",
} as const;

/** Community image lifecycle state. */
export type CommunityMediaStatus =
  (typeof COMMUNITY_MEDIA_STATUS)[keyof typeof COMMUNITY_MEDIA_STATUS];

/** Stable machine-readable community media failures. */
export const COMMUNITY_MEDIA_ERROR_CODE = {
  /** Image bytes, type, size, count, identity, or lifecycle state is invalid. */
  INVALID_MEDIA: "COMMUNITY_MEDIA_INVALID",
  /** The current user does not own the requested media. */
  MEDIA_FORBIDDEN: "COMMUNITY_MEDIA_FORBIDDEN",
  /** The media was already bound by another concurrent request. */
  MEDIA_CONFLICT: "COMMUNITY_MEDIA_CONFLICT",
  /** The configured object store is temporarily unavailable. */
  STORAGE_UNAVAILABLE: "COMMUNITY_MEDIA_STORAGE_UNAVAILABLE",
} as const;

/** Public metadata for one server-validated community image. */
export interface CommunityMediaAsset {
  /** Managed media identity used when creating a community post. */
  id: string;
  /** Public image URL resolved by the server-owned storage adapter. */
  url: string;
  /** Server-detected image MIME type. */
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** Decoded image width in pixels. */
  width: number;
  /** Decoded image height in pixels. */
  height: number;
  /** Uploaded image size in bytes. */
  sizeBytes: number;
}

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
  /** 用户举报数量。 */
  reportsCount: number;
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

/** 后台帖子审核动作。 */
export const COMMUNITY_POST_MODERATION_ACTION = {
  /** 将待审核帖子公开发布。 */
  APPROVE: "approve",
  /** 驳回待审核帖子。 */
  REJECT: "reject",
  /** 下架已发布帖子。 */
  OFFLINE: "offline",
} as const;

/** 后台帖子审核动作类型。 */
export type CommunityPostModerationAction =
  (typeof COMMUNITY_POST_MODERATION_ACTION)[keyof typeof COMMUNITY_POST_MODERATION_ACTION];

/** 后台帖子审核历史事件。 */
export interface AdminContentPostModerationEvent {
  /** 审核事件唯一标识。 */
  id: string;
  /** 本次审核动作。 */
  action: CommunityPostModerationAction;
  /** 执行动作前的帖子状态。 */
  previousStatus: AdminContentPostStatus;
  /** 执行动作后的帖子状态。 */
  nextStatus: AdminContentPostStatus;
  /** 驳回或下架原因；通过时为 null。 */
  reason: string | null;
  /** 执行审核动作的管理员。 */
  operator: AdminContentAuthorSummary;
  /** 审核动作发生时间，ISO 8601 格式。 */
  createdAt: string;
}

/** 后台帖子完整详情。 */
export interface AdminContentPostDetail extends AdminContentPostListItem {
  /** 帖子完整正文。 */
  content: string;
  /** 帖子图片公开地址，保持作者提交顺序。 */
  mediaUrls: string[];
  /** 当前驳回或下架原因；无原因时为 null。 */
  moderationReason: string | null;
  /** 按发生时间倒序排列的审核历史。 */
  moderationHistory: AdminContentPostModerationEvent[];
}

/** 后台帖子审核命令。 */
export interface AdminContentPostStateRequest {
  /** 操作者看到的帖子最后更新时间，用于拒绝过期命令。 */
  expectedUpdatedAt: string;
  /** 驳回或下架原因；通过命令不使用该字段。 */
  reason?: string;
}

/** 登录用户提交文字社区动态的请求。 */
export interface CreateCommunityPostRequest {
  /** 去除首尾空白后的动态正文，长度为 1 至 1000 个字符。 */
  content: string;
  /** 当前用户拥有且尚未绑定的社区图片标识，最多 9 个且不可重复。 */
  mediaAssetIds?: string[];
}

/** 作者查看的社区动态摘要。 */
export interface MyCommunityPostListItem {
  /** 社区动态唯一标识。 */
  id: string;
  /** 作者提交的完整文字正文。 */
  content: string;
  /** 该动态已绑定图片的公开地址，保持作者提交顺序。 */
  mediaUrls: string[];
  /** 当前审核和公开状态。 */
  status: CommunityPostStatus;
  /** 审核驳回原因；仅 rejected 状态返回，否则为 null。 */
  moderationReason: string | null;
  /** 动态创建时间，ISO 8601 格式。 */
  createdAt: string;
  /** 动态最后更新时间，ISO 8601 格式。 */
  updatedAt: string;
}

/** 作者自己的社区动态分页查询。 */
export interface MyCommunityPostListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 50。 */
  pageSize: number;
}

/** 作者自己的社区动态分页响应。 */
export type MyCommunityPostListResponse = PaginatedResponse<MyCommunityPostListItem>;

/** Controlled reasons accepted when reporting a published community post. */
export const COMMUNITY_POST_REPORT_REASON = {
  /** Repeated advertising, scams, or other spam. */
  SPAM: "spam",
  /** Harassment, threats, or abusive language. */
  HARASSMENT: "harassment",
  /** Sexual, violent, or otherwise inappropriate content. */
  INAPPROPRIATE: "inappropriate",
  /** Exposure of personal or sensitive information. */
  PRIVACY: "privacy",
  /** A report that does not match another controlled reason. */
  OTHER: "other",
} as const;

/** Controlled community post report reason. */
export type CommunityPostReportReason =
  (typeof COMMUNITY_POST_REPORT_REASON)[keyof typeof COMMUNITY_POST_REPORT_REASON];

/** User-facing labels for controlled community post report reasons. */
export const COMMUNITY_POST_REPORT_REASON_LABELS: Readonly<
  Record<CommunityPostReportReason, string>
> = {
  /** Spam reason label. */
  spam: "垃圾广告或诈骗",
  /** Harassment reason label. */
  harassment: "骚扰或辱骂",
  /** Inappropriate-content reason label. */
  inappropriate: "不当或违规内容",
  /** Privacy reason label. */
  privacy: "泄露隐私",
  /** Other reason label. */
  other: "其他问题",
};

/** Lifecycle states for one community post report. */
export const COMMUNITY_POST_REPORT_STATUS = {
  /** The associated post remains public and awaits moderation. */
  PENDING: "pending",
  /** The associated post was taken offline or deleted. */
  RESOLVED: "resolved",
} as const;

/** Community post report lifecycle state. */
export type CommunityPostReportStatus =
  (typeof COMMUNITY_POST_REPORT_STATUS)[keyof typeof COMMUNITY_POST_REPORT_STATUS];

/** Stable machine-readable community publishing limiter failures. */
export const COMMUNITY_RATE_LIMIT_ERROR_CODE = {
  /** The author exhausted the post creation window. */
  POST_RATE_LIMITED: "COMMUNITY_POST_RATE_LIMITED",
  /** The uploader exhausted the media upload window. */
  MEDIA_RATE_LIMITED: "COMMUNITY_MEDIA_RATE_LIMITED",
  /** Redis could not enforce a publishing window, so the write failed closed. */
  UNAVAILABLE: "COMMUNITY_RATE_LIMIT_UNAVAILABLE",
} as const;

/** Request for reporting one published community post. */
export interface CreateCommunityPostReportRequest {
  /** Selected controlled report reason. */
  reason: CommunityPostReportReason;
  /** Optional trimmed context, limited to 500 characters. */
  description?: string;
}

/** Minimal receipt returned after a report is accepted. */
export interface CommunityPostReportReceipt {
  /** Report identifier. */
  id: string;
  /** Initial report state. */
  status: CommunityPostReportStatus;
  /** Report creation time in ISO 8601 format. */
  createdAt: string;
}

/** Authenticated user's idempotent like state for one published community post. */
export interface CommunityPostLikeState {
  /** Whether the current user has liked the post. */
  liked: boolean;
  /** Current persisted like count for the post. */
  likesCount: number;
}

/** Lifecycle states for one community post comment. */
export const COMMUNITY_POST_COMMENT_STATUS = {
  /** The comment is visible below its published post. */
  PUBLISHED: "published",
  /** An administrator removed the comment from public view. */
  OFFLINE: "offline",
  /** The commenter deleted the comment. */
  DELETED: "deleted",
} as const;

/** Community post comment lifecycle state. */
export type CommunityPostCommentStatus =
  (typeof COMMUNITY_POST_COMMENT_STATUS)[keyof typeof COMMUNITY_POST_COMMENT_STATUS];

/** Request for publishing a plain-text comment below one community post. */
export interface CreateCommunityPostCommentRequest {
  /** Trimmed plain text from 1 through 200 characters. */
  content: string;
}

/** Public comment data without private account fields. */
export interface PublicCommunityPostComment {
  /** Comment identifier used by an authorized owner deletion command. */
  id: string;
  /** Public commenter name and avatar. */
  author: PublicCommunityPostAuthor;
  /** Plain-text comment body. */
  content: string;
  /** Whether the authenticated viewer may delete this comment. */
  canDelete: boolean;
  /** Comment creation time in ISO 8601 format. */
  createdAt: string;
}

/** Public paginated visible comments below one published post. */
export type PublicCommunityPostCommentListResponse = PaginatedResponse<PublicCommunityPostComment>;

/** Administrator-visible comment and commenter context. */
export interface AdminCommunityPostComment {
  /** Comment identifier. */
  id: string;
  /** Related community post identifier. */
  postId: string;
  /** Commenter account context visible only to authorized moderators. */
  commenter: AdminContentAuthorSummary;
  /** Plain-text comment body. */
  content: string;
  /** Current comment lifecycle state. */
  status: CommunityPostCommentStatus;
  /** Administrator-supplied offline reason, or null. */
  moderationReason: string | null;
  /** Comment creation time in ISO 8601 format. */
  createdAt: string;
  /** Comment last update time in ISO 8601 format. */
  updatedAt: string;
}

/** Administrator paginated comment context for one post. */
export type AdminCommunityPostCommentListResponse = PaginatedResponse<AdminCommunityPostComment>;

/** Command for taking one visible comment offline. */
export interface AdminCommunityPostCommentOfflineRequest {
  /** Trimmed moderation reason from 1 through 500 characters. */
  reason: string;
}

/** Post fields attached to an administrator's report context. */
export interface AdminCommunityPostReportPostSummary {
  /** Related community post identifier. */
  id: string;
  /** Related post lifecycle state. */
  status: CommunityPostStatus;
}

/** Administrator-visible community post report. */
export interface AdminCommunityPostReport {
  /** Report identifier. */
  id: string;
  /** User who submitted the report. */
  reporter: AdminContentAuthorSummary;
  /** Related post context. */
  post: AdminCommunityPostReportPostSummary;
  /** Controlled report reason. */
  reason: CommunityPostReportReason;
  /** Optional reporter-provided context. */
  description: string | null;
  /** Report handling state. */
  status: CommunityPostReportStatus;
  /** Report creation time in ISO 8601 format. */
  createdAt: string;
  /** Resolution time, or null while pending. */
  resolvedAt: string | null;
}

/** Administrator response containing every report for one post. */
export interface AdminCommunityPostReportResponse {
  /** Reports ordered newest first. */
  list: AdminCommunityPostReport[];
  /** Total reports attached to the post. */
  total: number;
}

/** Public community author fields safe for unauthenticated readers. */
export interface PublicCommunityPostAuthor {
  /** Display name selected from the author's public profile fields. */
  displayName: string;
  /** Optional public avatar URL. */
  avatar: string | null;
}

/** Published community post exposed to unauthenticated readers. */
export interface PublicCommunityPostListItem {
  /** Community post identifier used by the detail route. */
  id: string;
  /** Public author display data without account contact fields. */
  author: PublicCommunityPostAuthor;
  /** Full published post text. */
  content: string;
  /** Public image URLs in author-selected order. */
  mediaUrls: string[];
  /** Current persisted like count. */
  likesCount: number;
  /** Current visible comment count. */
  commentsCount: number;
  /** Post creation time in ISO 8601 format. */
  createdAt: string;
}

/** Published community post detail. */
export type PublicCommunityPostDetail = PublicCommunityPostListItem;

/** Pagination accepted by the public community feed. */
export interface PublicCommunityPostListQuery {
  /** One-based result page. */
  page: number;
  /** Number of posts per page, from 1 through 50. */
  pageSize: number;
}

/** Public paginated community feed response. */
export type PublicCommunityPostListResponse = PaginatedResponse<PublicCommunityPostListItem>;

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
