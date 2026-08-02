import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminClassroomArticleListItem,
  AdminClassroomArticleListResponse,
  AdminContentAuthorSummary,
  AdminContentPetSummary,
  AdminContentPostListItem,
  AdminContentPostListResponse,
  AdminContentRewardListItem,
  AdminContentRewardListResponse,
} from "@petcare/shared-types";

/** 内容作者摘要响应。 */
export class AdminContentAuthorSummaryDto implements AdminContentAuthorSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  phone: string;

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

/** 后台课堂文章列表项响应。 */
export class AdminClassroomArticleListItemDto implements AdminClassroomArticleListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  summary: string;

  @ApiProperty({ nullable: true })
  coverUrl: string | null;

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
