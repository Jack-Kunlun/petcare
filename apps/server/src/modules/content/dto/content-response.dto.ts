import { ApiProperty } from "@nestjs/swagger";
import {
  CLASSROOM_ARTICLE_CATEGORY,
  COMMUNITY_POST_COMMENT_STATUS,
  COMMUNITY_POST_MODERATION_ACTION,
  COMMUNITY_POST_REPORT_REASON,
  COMMUNITY_POST_REPORT_STATUS,
} from "@petcare/shared-types";
import type {
  AdminCommunityPostComment,
  AdminCommunityPostCommentListResponse,
  AdminCommunityPostReport,
  AdminCommunityPostReportPostSummary,
  AdminCommunityPostReportResponse,
  AdminClassroomArticleDetail,
  AdminClassroomArticleListItem,
  AdminClassroomArticleListResponse,
  AdminContentAuthorSummary,
  AdminContentPostDetail,
  AdminContentPetSummary,
  AdminContentPostListItem,
  AdminContentPostListResponse,
  AdminContentPostModerationEvent,
  AdminContentRewardListItem,
  AdminContentRewardListResponse,
  PublicClassroomArticleAuthor,
  PublicClassroomArticleDetail,
  PublicClassroomArticleListItem,
  PublicClassroomArticleListResponse,
} from "@petcare/shared-types";

/** 内容作者摘要响应。 */
export class AdminContentAuthorSummaryDto implements AdminContentAuthorSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ nullable: true })
  username: string | null;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

/** 内容宠物摘要响应。 */
export class AdminContentPetSummaryDto implements AdminContentPetSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  breed: string;
}

/** 后台悬赏列表项响应。 */
export class AdminContentRewardListItemDto implements AdminContentRewardListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "feeding" })
  serviceType: AdminContentRewardListItem["serviceType"];

  @ApiProperty({ type: AdminContentAuthorSummaryDto })
  owner: AdminContentAuthorSummaryDto;

  @ApiProperty({ type: AdminContentPetSummaryDto })
  pet: AdminContentPetSummaryDto;

  @ApiProperty({ example: 120.5 })
  rewardAmount: number;

  @ApiProperty({ example: "pending_confirm" })
  status: AdminContentRewardListItem["status"];

  @ApiProperty({ format: "date-time" })
  serviceTime: string;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** 后台悬赏列表响应。 */
export class AdminContentRewardListResponseDto implements AdminContentRewardListResponse {
  @ApiProperty({ type: [AdminContentRewardListItemDto] })
  list: AdminContentRewardListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

/** 后台帖子列表项响应。 */
export class AdminContentPostListItemDto implements AdminContentPostListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ type: AdminContentAuthorSummaryDto })
  author: AdminContentAuthorSummaryDto;

  @ApiProperty()
  contentExcerpt: string;

  @ApiProperty({ example: 3 })
  mediaCount: number;

  @ApiProperty({ example: 12 })
  likesCount: number;

  @ApiProperty({ example: 4 })
  commentsCount: number;

  @ApiProperty({ example: 2 })
  sharesCount: number;

  @ApiProperty({ example: 1 })
  reportsCount: number;

  @ApiProperty({ example: "published" })
  status: AdminContentPostListItem["status"];

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** 后台帖子列表响应。 */
export class AdminContentPostListResponseDto implements AdminContentPostListResponse {
  @ApiProperty({ type: [AdminContentPostListItemDto] })
  list: AdminContentPostListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

/** 后台帖子审核历史事件响应。 */
export class AdminContentPostModerationEventDto implements AdminContentPostModerationEvent {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: Object.values(COMMUNITY_POST_MODERATION_ACTION) })
  action: AdminContentPostModerationEvent["action"];

  @ApiProperty({ example: "pending" })
  previousStatus: AdminContentPostModerationEvent["previousStatus"];

  @ApiProperty({ example: "published" })
  nextStatus: AdminContentPostModerationEvent["nextStatus"];

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty({ type: AdminContentAuthorSummaryDto })
  operator: AdminContentAuthorSummaryDto;

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** 后台帖子完整详情响应。 */
export class AdminContentPostDetailDto
  extends AdminContentPostListItemDto
  implements AdminContentPostDetail
{
  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  mediaUrls: string[];

  @ApiProperty({ nullable: true })
  moderationReason: string | null;

  @ApiProperty({ type: [AdminContentPostModerationEventDto] })
  moderationHistory: AdminContentPostModerationEventDto[];
}

/** Related post fields shown in the administrator's report context. */
export class AdminCommunityPostReportPostSummaryDto implements AdminCommunityPostReportPostSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "published" })
  status: AdminCommunityPostReportPostSummary["status"];
}

/** Administrator-visible report and reporter context. */
export class AdminCommunityPostReportDto implements AdminCommunityPostReport {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ type: AdminContentAuthorSummaryDto })
  reporter: AdminContentAuthorSummaryDto;

  @ApiProperty({ type: AdminCommunityPostReportPostSummaryDto })
  post: AdminCommunityPostReportPostSummaryDto;

  @ApiProperty({ enum: Object.values(COMMUNITY_POST_REPORT_REASON) })
  reason: AdminCommunityPostReport["reason"];

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: Object.values(COMMUNITY_POST_REPORT_STATUS) })
  status: AdminCommunityPostReport["status"];

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time", nullable: true })
  resolvedAt: string | null;
}

/** Every report submitted for one administrator-visible post. */
export class AdminCommunityPostReportResponseDto implements AdminCommunityPostReportResponse {
  @ApiProperty({ type: [AdminCommunityPostReportDto] })
  list: AdminCommunityPostReportDto[];

  @ApiProperty()
  total: number;
}

/** Administrator-visible community comment context. */
export class AdminCommunityPostCommentDto implements AdminCommunityPostComment {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  postId: string;

  @ApiProperty({ type: AdminContentAuthorSummaryDto })
  commenter: AdminContentAuthorSummaryDto;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: Object.values(COMMUNITY_POST_COMMENT_STATUS) })
  status: AdminCommunityPostComment["status"];

  @ApiProperty({ nullable: true })
  moderationReason: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** Paginated administrator comment context for one post. */
export class AdminCommunityPostCommentListResponseDto implements AdminCommunityPostCommentListResponse {
  @ApiProperty({ type: [AdminCommunityPostCommentDto] })
  list: AdminCommunityPostCommentDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** 后台课堂文章列表项响应。 */
export class AdminClassroomArticleListItemDto implements AdminClassroomArticleListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ enum: Object.values(CLASSROOM_ARTICLE_CATEGORY), nullable: true })
  category: AdminClassroomArticleListItem["category"];

  @ApiProperty()
  title: string;

  @ApiProperty()
  summary: string;

  @ApiProperty({ nullable: true })
  coverUrl: string | null;

  @ApiProperty({ format: "uri" })
  publicUrl: string;

  @ApiProperty({ example: "published" })
  status: AdminClassroomArticleListItem["status"];

  @ApiProperty({ type: AdminContentAuthorSummaryDto, nullable: true })
  author: AdminContentAuthorSummaryDto | null;

  @ApiProperty({ format: "date-time", nullable: true })
  publishedAt: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** 后台课堂文章完整详情响应。 */
export class AdminClassroomArticleDetailDto
  extends AdminClassroomArticleListItemDto
  implements AdminClassroomArticleDetail
{
  @ApiProperty({ description: "Server-cleaned editor HTML." })
  bodyHtml: string;
}

/** 后台课堂文章列表响应。 */
export class AdminClassroomArticleListResponseDto implements AdminClassroomArticleListResponse {
  @ApiProperty({ type: [AdminClassroomArticleListItemDto] })
  list: AdminClassroomArticleListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

/** Public author display data for the official website. */
export class PublicClassroomArticleAuthorDto implements PublicClassroomArticleAuthor {
  @ApiProperty()
  displayName: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

/** Public classroom article summary for the official website. */
export class PublicClassroomArticleListItemDto implements PublicClassroomArticleListItem {
  @ApiProperty({ description: "Stable route value; currently the article ID." })
  slug: string;

  @ApiProperty({ enum: Object.values(CLASSROOM_ARTICLE_CATEGORY), nullable: true })
  category: PublicClassroomArticleListItem["category"];

  @ApiProperty()
  title: string;

  @ApiProperty()
  summary: string;

  @ApiProperty({ nullable: true })
  coverUrl: string | null;

  @ApiProperty({ type: PublicClassroomArticleAuthorDto, nullable: true })
  author: PublicClassroomArticleAuthorDto | null;

  @ApiProperty({ format: "date-time", nullable: true })
  publishedAt: string | null;
}

/** Public classroom article detail with server-cleaned HTML. */
export class PublicClassroomArticleDetailDto
  extends PublicClassroomArticleListItemDto
  implements PublicClassroomArticleDetail
{
  @ApiProperty({ description: "Server-cleaned article HTML." })
  bodyHtml: string;
}

/** Public paginated classroom article response. */
export class PublicClassroomArticleListResponseDto implements PublicClassroomArticleListResponse {
  @ApiProperty({ type: [PublicClassroomArticleListItemDto] })
  list: PublicClassroomArticleListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
