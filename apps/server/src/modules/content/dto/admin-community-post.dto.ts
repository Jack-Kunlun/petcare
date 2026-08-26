import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AdminContentPostStateRequest } from "@petcare/shared-types";
import { Transform } from "class-transformer";
import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Validated optimistic-concurrency command for community post moderation. */
export class AdminContentPostStateDto implements AdminContentPostStateRequest {
  @ApiProperty({ format: "date-time" })
  @IsISO8601({ strict: true, strictSeparator: true })
  expectedUpdatedAt: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
