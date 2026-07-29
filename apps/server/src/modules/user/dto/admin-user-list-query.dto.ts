import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class AdminUserListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ description: "手机号、账号或昵称" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @ApiPropertyOptional({ enum: ["pet_owner", "provider"] })
  @IsOptional()
  @IsIn(["pet_owner", "provider"])
  userType?: "pet_owner" | "provider";

  @ApiPropertyOptional({ enum: ["active", "inactive", "banned"] })
  @IsOptional()
  @IsIn(["active", "inactive", "banned"])
  status?: "active" | "inactive" | "banned";
}
