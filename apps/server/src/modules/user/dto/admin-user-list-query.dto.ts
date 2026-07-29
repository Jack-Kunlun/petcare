import { ApiPropertyOptional } from "@nestjs/swagger";
import { ADMIN_USER_STATUS, ADMIN_USER_TYPE } from "@petcare/shared-types";
import type { AdminUserListQuery, AdminUserStatus, AdminUserType } from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const userTypes = Object.values(ADMIN_USER_TYPE);
const userStatuses = Object.values(ADMIN_USER_STATUS);

/** 校验并描述后台用户分页查询参数。 */
export class AdminUserListQueryDto implements AdminUserListQuery {
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

  @ApiPropertyOptional({ enum: userTypes })
  @IsOptional()
  @IsIn(userTypes)
  userType?: AdminUserType;

  @ApiPropertyOptional({ enum: userStatuses })
  @IsOptional()
  @IsIn(userStatuses)
  status?: AdminUserStatus;
}
