import { ApiProperty } from "@nestjs/swagger";
import type { ClaimComplaintRequest, TransferComplaintRequest } from "@petcare/shared-types";
import { Transform } from "class-transformer";
import { IsInt, IsString, IsUUID, Length, Min } from "class-validator";

/** 校验管理员认领案件时提交的并发版本。 */
export class ClaimComplaintDto implements ClaimComplaintRequest {
  /** 客户端读取案件详情时获得的并发版本。 */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}

/** 校验管理员转交案件时提交的目标、原因与并发版本。 */
export class TransferComplaintDto extends ClaimComplaintDto implements TransferComplaintRequest {
  /** 接收案件的目标管理员唯一标识。 */
  @ApiProperty({ description: "接收案件的管理员唯一标识", format: "uuid" })
  @IsUUID()
  targetAdminId: string;

  /** 本次案件转交的原因。 */
  @ApiProperty({ minLength: 2, maxLength: 500 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 500)
  reason: string;
}
