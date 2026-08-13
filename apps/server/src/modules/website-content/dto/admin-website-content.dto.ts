import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  WEBSITE_CONTENT_DIFF_CHANGE_TYPE,
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  WEBSITE_SECTION_TYPE,
  type CreateWebsitePreviewRequest,
  type PublishWebsiteContentRequest,
  type RestoreWebsiteContentRequest,
  type SaveWebsiteContentDraftRequest,
  type WebsiteContentDiffItem,
  type WebsiteContentHistoryQuery,
  type WebsiteContentKey,
  type WebsiteContentOperatorSummary,
  type WebsiteContentOverviewItem,
  type WebsiteContentSection,
  type WebsiteContentStatus,
  type WebsiteContentVersion,
  type WebsiteImageReference,
  type WebsiteSeoContent,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const CONTENT_KEYS = Object.values(WEBSITE_CONTENT_KEY);
const SECTION_TYPES = Object.values(WEBSITE_SECTION_TYPE);
const CONTENT_STATUSES: WebsiteContentStatus[] = Object.values(WEBSITE_CONTENT_STATUS);

/** Runtime representation of a managed image reference in a Website Content request. */
export class WebsiteImageReferenceDto implements WebsiteImageReference {
  /** Existing managed media id, or null for the approved bundled fallback. */
  @ApiProperty({ nullable: true, example: "cmf2q6u3s0001q8s8gwg2p0wk" })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Length(1, 128)
  assetId: string | null;

  /** Accessible text describing the image in its section context. */
  @ApiProperty({ minLength: 1, maxLength: 250 })
  @IsString()
  @Length(1, 250)
  @Matches(/\S/u)
  altText: string;
}

/** Runtime representation of immutable snapshot SEO metadata. */
export class WebsiteSeoContentDto implements WebsiteSeoContent {
  /** Search-result title. */
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/u)
  title: string;

  /** Search-result description. */
  @ApiProperty({ minLength: 1, maxLength: 300 })
  @IsString()
  @Length(1, 300)
  @Matches(/\S/u)
  description: string;

  /** Fixed website-owned canonical route. */
  @ApiProperty({ example: "/services" })
  @IsString()
  @Length(1, 200)
  @Matches(/^\/[\w/-]*$/u)
  canonicalPath: `/${string}`;

  /** Optional managed social image. */
  @ApiProperty({ type: WebsiteImageReferenceDto, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @ValidateNested()
  @Type(() => WebsiteImageReferenceDto)
  image: WebsiteImageReferenceDto | null;
}

/** Runtime envelope for one registry-validated preset Website Content section. */
export class WebsiteContentSectionDto {
  /** Stable template-owned section key. */
  @ApiProperty({ example: "hero" })
  @IsString()
  @Length(1, 128)
  @Matches(/^[a-z][a-z0-9_]*$/u)
  sectionKey: string;

  /** Registered section renderer discriminator. */
  @ApiProperty({ enum: SECTION_TYPES })
  @IsIn(SECTION_TYPES)
  sectionType: WebsiteContentSection["sectionType"];

  /** Future-compatible sort value, locked by the current template registry. */
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;

  /** Whether the fixed section is rendered. */
  @ApiProperty()
  @IsBoolean()
  isEnabled: boolean;

  /** First-release schema version, validated again by the section registry. */
  @ApiProperty({ enum: [1] })
  @Equals(1)
  schemaVersion: 1;

  /** Registered type-specific structured content. */
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  content: WebsiteContentSection["content"];

  /** Registered type-specific bounded presentation settings. */
  @ApiProperty({ type: "object", additionalProperties: true })
  @IsObject()
  settings: WebsiteContentSection["settings"];
}

/** Request body for creating a new immutable Website Content draft. */
export class SaveWebsiteContentDraftDto implements SaveWebsiteContentDraftRequest {
  /** Optimistic revision read by the editor. */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  /** Non-empty business explanation for the immutable save. */
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @Length(1, 500)
  @Matches(/\S/u)
  changeSummary: string;

  /** Complete SEO snapshot. */
  @ApiProperty({ type: WebsiteSeoContentDto })
  @ValidateNested()
  @Type(() => WebsiteSeoContentDto)
  seo: WebsiteSeoContentDto;

  /** Complete fixed-template section snapshot. */
  @ApiProperty({ type: [WebsiteContentSectionDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WebsiteContentSectionDto)
  sections: WebsiteContentSection[];
}

/** Request body for an explicit page-scoped publish. */
export class PublishWebsiteContentDto implements PublishWebsiteContentRequest {
  /** Saved draft revision to publish. */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  /** Idempotency key for safe publish retries. */
  @ApiProperty({ minLength: 8, maxLength: 200, example: "website-home-20260813-1" })
  @IsString()
  @Length(8, 200)
  @Matches(/\S/u)
  idempotencyKey: string;

  /** Business explanation shown in publish history. */
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @Length(1, 500)
  @Matches(/\S/u)
  changeSummary: string;
}

/** Request body for creating a fixed-revision preview capability. */
export class CreateWebsitePreviewDto implements CreateWebsitePreviewRequest {
  /** Exact saved draft revision to pin into the capability. */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision: number;
}

/** Request body for restoring a historical snapshot as a fresh draft. */
export class RestoreWebsiteContentDto implements RestoreWebsiteContentRequest {
  /** Historical immutable version identity. */
  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  versionId: string;

  /** Current draft revision used for optimistic locking. */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  /** Non-empty restore explanation. */
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @Length(1, 500)
  @Matches(/\S/u)
  changeSummary: string;
}

/** Pagination query for published Website Content history. */
export class WebsiteContentHistoryQueryDto implements WebsiteContentHistoryQuery {
  /** One-based history page. */
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** Maximum immutable history entries per page. */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

/** Operator identity safely exposed in Admin version responses. */
export class WebsiteContentOperatorSummaryDto implements WebsiteContentOperatorSummary {
  /** Operator identity. */
  @ApiProperty()
  id: string;

  /** Current display name. */
  @ApiProperty()
  displayName: string;
}

/** Swagger response model for one complete immutable Website Content version. */
export class WebsiteContentVersionResponseDto implements WebsiteContentVersion {
  /** Immutable version identity. */
  @ApiProperty()
  id: string;

  /** Independently published content identity key. */
  @ApiProperty({ enum: CONTENT_KEYS })
  contentKey: WebsiteContentKey;

  /** Monotonic optimistic-lock revision. */
  @ApiProperty()
  revision: number;

  /** Public business version, or null before publication. */
  @ApiProperty({ nullable: true })
  businessVersion: number | null;

  /** Immutable version lifecycle state. */
  @ApiProperty({ enum: CONTENT_STATUSES })
  status: WebsiteContentStatus;

  /** Immutable business summary. */
  @ApiProperty()
  changeSummary: string;

  /** Snapshot SEO metadata. */
  @ApiProperty({ type: WebsiteSeoContentDto })
  seo: WebsiteSeoContentDto;

  /** Ordered preset section snapshot. */
  @ApiProperty({ type: [WebsiteContentSectionDto] })
  sections: WebsiteContentSection[];

  /** Source snapshot used to create this version. */
  @ApiProperty({ nullable: true })
  sourceVersionId: string | null;

  /** Snapshot creator. */
  @ApiProperty({ type: WebsiteContentOperatorSummaryDto })
  createdBy: WebsiteContentOperatorSummaryDto;

  /** Snapshot creation timestamp. */
  @ApiProperty({ format: "date-time" })
  createdAt: string;

  /** Publisher when this snapshot has entered history. */
  @ApiProperty({ type: WebsiteContentOperatorSummaryDto, nullable: true })
  publishedBy: WebsiteContentOperatorSummaryDto | null;

  /** Publication timestamp when available. */
  @ApiProperty({ format: "date-time", nullable: true })
  publishedAt: string | null;
}

/** Swagger response model for one Admin overview row. */
export class WebsiteContentOverviewItemDto implements WebsiteContentOverviewItem {
  /** Content identity key. */
  @ApiProperty({ enum: CONTENT_KEYS })
  contentKey: WebsiteContentKey;

  /** Current draft revision. */
  @ApiProperty()
  draftRevision: number;

  /** Current published business version. */
  @ApiProperty({ nullable: true })
  publishedBusinessVersion: number | null;

  /** Whether the draft differs from published content. */
  @ApiProperty()
  hasUnpublishedChanges: boolean;

  /** Last editor. */
  @ApiProperty({ type: WebsiteContentOperatorSummaryDto })
  lastEditedBy: WebsiteContentOperatorSummaryDto;

  /** Last save timestamp. */
  @ApiProperty({ format: "date-time" })
  lastEditedAt: string;

  /** Latest publication timestamp. */
  @ApiProperty({ format: "date-time", nullable: true })
  publishedAt: string | null;
}

/** Swagger response model for one stable field-level difference. */
export class WebsiteContentDiffItemDto implements WebsiteContentDiffItem {
  /** Stable dotted field path. */
  @ApiProperty()
  path: string;

  /** Value before the change. */
  @ApiProperty({ nullable: true })
  before: WebsiteContentDiffItem["before"];

  /** Value after the change. */
  @ApiProperty({ nullable: true })
  after: WebsiteContentDiffItem["after"];

  /** Difference kind. */
  @ApiProperty({ enum: Object.values(WEBSITE_CONTENT_DIFF_CHANGE_TYPE) })
  changeType: WebsiteContentDiffItem["changeType"];
}

/** Swagger response model for paginated immutable history. */
export class WebsiteContentHistoryResponseDto {
  /** History page entries. */
  @ApiProperty({ type: [WebsiteContentVersionResponseDto] })
  list: WebsiteContentVersionResponseDto[];

  /** Total matching history entries. */
  @ApiProperty()
  total: number;

  /** One-based page number. */
  @ApiProperty()
  page: number;

  /** Requested page size. */
  @ApiProperty()
  pageSize: number;
}

/** Swagger response model for a completed explicit publish. */
export class PublishWebsiteContentResponseDto {
  /** Published immutable snapshot. */
  @ApiProperty({ type: WebsiteContentVersionResponseDto })
  published: WebsiteContentVersionResponseDto;

  /** Fresh editable draft cloned after publication. */
  @ApiProperty({ type: WebsiteContentVersionResponseDto })
  draft: WebsiteContentVersionResponseDto;
}

/** Swagger response model for a fixed-revision preview capability. */
export class CreateWebsitePreviewResponseDto {
  /** Fragment-token preview URL. */
  @ApiProperty({ format: "uri" })
  previewUrl: string;

  /** Capability expiry time. */
  @ApiProperty({ format: "date-time" })
  expiresAt: string;

  /** Permanently selected draft revision. */
  @ApiProperty()
  revision: number;
}
