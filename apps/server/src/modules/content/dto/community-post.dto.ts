import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type {
  CommunityMediaAsset,
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
  PublicCommunityPostAuthor,
  PublicCommunityPostDetail,
  PublicCommunityPostListQuery,
  PublicCommunityPostListResponse,
} from "@petcare/shared-types";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** Validated input for submitting a community post. */
export class CreateCommunityPostDto implements CreateCommunityPostRequest {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({ type: [String], maxItems: 9, default: [] })
  @IsArray()
  @ArrayMaxSize(9)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  mediaAssetIds?: string[] = [];
}

/** Public response for one validated community image upload. */
export class CommunityMediaAssetDto implements CommunityMediaAsset {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uri" })
  url: string;

  @ApiProperty({ enum: ["image/jpeg", "image/png", "image/webp"] })
  mimeType: CommunityMediaAsset["mimeType"];

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty()
  sizeBytes: number;
}

/** Pagination for the authenticated author's own community posts. */
export class MyCommunityPostListQueryDto implements MyCommunityPostListQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

/** Author-visible community post summary. */
export class MyCommunityPostListItemDto implements MyCommunityPostListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  mediaUrls: string[];

  @ApiProperty({ enum: Object.values(ADMIN_CONTENT_POST_STATUS) })
  status: MyCommunityPostListItem["status"];

  @ApiProperty({ nullable: true })
  moderationReason: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

/** Paginated author-only community post response. */
export class MyCommunityPostListResponseDto implements MyCommunityPostListResponse {
  @ApiProperty({ type: [MyCommunityPostListItemDto] })
  list: MyCommunityPostListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

/** Pagination for the unauthenticated published community feed. */
export class PublicCommunityPostListQueryDto implements PublicCommunityPostListQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

/** Public author fields safe for unauthenticated readers. */
export class PublicCommunityPostAuthorDto implements PublicCommunityPostAuthor {
  @ApiProperty()
  displayName: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

/** Public published community post response. */
export class PublicCommunityPostDetailDto implements PublicCommunityPostDetail {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ type: PublicCommunityPostAuthorDto })
  author: PublicCommunityPostAuthorDto;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  mediaUrls: string[];

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** Public paginated community feed response. */
export class PublicCommunityPostListResponseDto implements PublicCommunityPostListResponse {
  @ApiProperty({ type: [PublicCommunityPostDetailDto] })
  list: PublicCommunityPostDetailDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
