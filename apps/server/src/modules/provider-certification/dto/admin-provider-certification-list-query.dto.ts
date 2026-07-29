import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  PROVIDER_CERTIFICATION_STATUS,
  type AdminProviderCertificationListQuery,
  type ProviderCertificationStatus,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const certificationStatuses = Object.values(PROVIDER_CERTIFICATION_STATUS);

/** 校验并描述后台认证申请分页查询参数。 */
export class AdminProviderCertificationListQueryDto implements AdminProviderCertificationListQuery {
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

  @ApiPropertyOptional({ description: "手机号、账号或昵称", maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;

  @ApiPropertyOptional({ enum: certificationStatuses })
  @IsOptional()
  @IsIn(certificationStatuses)
  status?: ProviderCertificationStatus;
}
