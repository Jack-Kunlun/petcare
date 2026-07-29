import { ApiProperty } from "@nestjs/swagger";
import type { RejectProviderCertificationRequest } from "@petcare/shared-types";
import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

/** 校验并描述驳回宠托师认证申请的请求。 */
export class RejectProviderCertificationDto implements RejectProviderCertificationRequest {
  @ApiProperty({ minLength: 2, maxLength: 500, example: "身份证照片不清晰，请重新提交" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 500)
  reason: string;
}
