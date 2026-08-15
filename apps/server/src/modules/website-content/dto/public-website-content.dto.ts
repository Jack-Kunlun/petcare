import { ApiProperty } from "@nestjs/swagger";
import type { WebsitePublicContent, WebsitePublicContentSection } from "@petcare/shared-types";

/** Swagger response model for a published Website Content snapshot. */
export class WebsitePublicContentResponseDto implements WebsitePublicContent {
  /** Independently published content key. */
  @ApiProperty()
  contentKey: WebsitePublicContent["contentKey"];

  /** Monotonic published business version. */
  @ApiProperty()
  businessVersion: number;

  /** Publication timestamp. */
  @ApiProperty({ format: "date-time" })
  publishedAt: string;

  /** Public SEO data with resolved managed media. */
  @ApiProperty({ type: "object", additionalProperties: true })
  seo: WebsitePublicContent["seo"];

  /** Enabled ordered public sections. */
  @ApiProperty({ type: "array", items: { type: "object" } })
  sections: WebsitePublicContentSection[];
}

/** Swagger response model for a capability-scoped unpublished preview snapshot. */
export class WebsitePreviewContentResponseDto implements Omit<
  WebsitePublicContent,
  "businessVersion" | "publishedAt"
> {
  /** Content key selected by the capability. */
  @ApiProperty()
  contentKey: WebsitePublicContent["contentKey"];

  /** Immutable draft revision selected by the capability. */
  @ApiProperty()
  revision: number;

  /** Public-safe SEO data. */
  @ApiProperty({ type: "object", additionalProperties: true })
  seo: WebsitePublicContent["seo"];

  /** Enabled ordered public sections. */
  @ApiProperty({ type: "array", items: { type: "object" } })
  sections: WebsitePublicContentSection[];
}
