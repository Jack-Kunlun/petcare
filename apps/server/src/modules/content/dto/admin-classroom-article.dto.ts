import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  AdminClassroomArticleStateRequest,
  CreateAdminClassroomArticleRequest,
  UpdateAdminClassroomArticleRequest,
} from "@petcare/shared-types";
import { Transform } from "class-transformer";
import { IsISO8601, IsOptional, IsString, IsUUID, Length, MaxLength } from "class-validator";

/** Input shared by classroom article creation and editable updates. */
export class CreateAdminClassroomArticleDto implements CreateAdminClassroomArticleRequest {
  /** Article title after leading and trailing whitespace is removed. */
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 120)
  title: string;

  /** Short article summary after leading and trailing whitespace is removed. */
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  summary: string;

  /** Untrusted editor HTML that the service sanitizes before persistence. */
  @ApiProperty({ maxLength: 200_000 })
  @IsString()
  @MaxLength(200_000)
  bodyHtml: string;

  /** Managed cover asset identity; null explicitly clears a cover during an update. */
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  coverAssetId?: string | null;
}

/** Input for changing a draft or offline classroom article with optimistic concurrency. */
export class UpdateAdminClassroomArticleDto
  extends CreateAdminClassroomArticleDto
  implements UpdateAdminClassroomArticleRequest
{
  /** Timestamp returned by the last article read, used to reject stale writes. */
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  expectedUpdatedAt: string;
}

/** Input for publishing or taking a classroom article offline with optimistic concurrency. */
export class AdminClassroomArticleStateDto implements AdminClassroomArticleStateRequest {
  /** Timestamp returned by the last article read, used to reject stale state changes. */
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true })
  expectedUpdatedAt: string;
}
