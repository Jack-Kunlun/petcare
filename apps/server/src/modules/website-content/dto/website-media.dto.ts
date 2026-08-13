import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  WEBSITE_MEDIA_STATUS,
  type WebsiteContentOperatorSummary,
  type WebsiteMediaAsset,
  type WebsiteMediaListQuery,
  type WebsiteMediaStatus,
  type WebsitePublicMediaAsset,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const MEDIA_STATUSES: WebsiteMediaStatus[] = Object.values(WEBSITE_MEDIA_STATUS);

/** Query for the managed Website Content media library. */
export class WebsiteMediaListQueryDto implements WebsiteMediaListQuery {
  /** One-based media page. */
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** Maximum media records per page. */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  /** Optional filename search. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string;

  /** Optional lifecycle filter. */
  @ApiPropertyOptional({ enum: MEDIA_STATUSES })
  @IsOptional()
  @IsIn(MEDIA_STATUSES)
  status?: WebsiteMediaStatus;
}

/** Safe public URL and image metadata. */
export class WebsitePublicMediaAssetDto implements WebsitePublicMediaAsset {
  /** Managed media identity. */
  @ApiProperty()
  id: string;

  /** Public HTTPS URL. */
  @ApiProperty({ format: "uri" })
  url: string;

  /** Image width. */
  @ApiProperty()
  width: number;

  /** Image height. */
  @ApiProperty()
  height: number;

  /** Validated MIME type. */
  @ApiProperty({ enum: ["image/jpeg", "image/png", "image/webp"] })
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

/** Admin media response without provider credentials or object keys. */
export class WebsiteMediaAssetResponseDto implements WebsiteMediaAsset {
  /** Managed media identity. */
  @ApiProperty()
  id: string;

  /** Original uploaded filename. */
  @ApiProperty()
  originalName: string;

  /** Validated MIME type. */
  @ApiProperty({ enum: ["image/jpeg", "image/png", "image/webp"] })
  mimeType: "image/jpeg" | "image/png" | "image/webp";

  /** Exact object size. */
  @ApiProperty()
  sizeBytes: number;

  /** Decoded width. */
  @ApiProperty()
  width: number;

  /** Decoded height. */
  @ApiProperty()
  height: number;

  /** Content checksum. */
  @ApiProperty()
  checksum: string;

  /** Media lifecycle state. */
  @ApiProperty({ enum: MEDIA_STATUSES })
  status: WebsiteMediaStatus;

  /** Safe public asset data. */
  @ApiProperty({ type: WebsitePublicMediaAssetDto })
  publicAsset: WebsitePublicMediaAssetDto;

  /** Creator summary. */
  @ApiProperty({ type: "object", additionalProperties: true })
  createdBy: WebsiteContentOperatorSummary;

  /** Registration timestamp. */
  @ApiProperty({ format: "date-time" })
  createdAt: string;

  /** Referencing snapshots that block archival. */
  @ApiProperty({ type: "array", items: { type: "object" } })
  references: WebsiteMediaAsset["references"];
}

/** Swagger response model for a paginated media library result. */
export class WebsiteMediaListResponseDto {
  /** Media page entries. */
  @ApiProperty({ type: [WebsiteMediaAssetResponseDto] })
  list: WebsiteMediaAssetResponseDto[];

  /** Total matching media records. */
  @ApiProperty()
  total: number;

  /** One-based page number. */
  @ApiProperty()
  page: number;

  /** Requested page size. */
  @ApiProperty()
  pageSize: number;
}
