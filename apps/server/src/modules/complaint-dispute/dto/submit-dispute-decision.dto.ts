import { ApiProperty } from "@nestjs/swagger";
import type { SubmitDisputeDecisionRequest } from "@petcare/shared-types";
import { Transform } from "class-transformer";
import { IsIn, IsInt, IsString, Length, Max, Min } from "class-validator";

const LIABILITY_VALUES: SubmitDisputeDecisionRequest["liability"][] = [
  "complainant",
  "respondent",
  "shared",
  "insufficient_evidence",
];

/** 校验管理员提交的初裁或终裁参数。 */
export class SubmitDisputeDecisionDto implements SubmitDisputeDecisionRequest {
  /** 裁决认定的责任划分。 */
  @ApiProperty({ enum: LIABILITY_VALUES })
  @IsIn(LIABILITY_VALUES)
  liability: SubmitDisputeDecisionRequest["liability"];

  /** 去除首尾空白后的裁决理由。 */
  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(10, 1000)
  reason: string;

  /** 退还投诉方的整数分金额。 */
  @ApiProperty({ minimum: 0, description: "退还投诉方的整数分金额" })
  @IsInt()
  @Min(0)
  refundAmount: number;

  /** 结算给服务方的整数分金额。 */
  @ApiProperty({ minimum: 0, description: "结算给服务方的整数分金额" })
  @IsInt()
  @Min(0)
  settlementAmount: number;

  /** 投诉方信用分调整值。 */
  @ApiProperty({ minimum: -100, maximum: 100 })
  @IsInt()
  @Min(-100)
  @Max(100)
  complainantCreditDelta: number;

  /** 被投诉方信用分调整值。 */
  @ApiProperty({ minimum: -100, maximum: 100 })
  @IsInt()
  @Min(-100)
  @Max(100)
  respondentCreditDelta: number;

  /** 客户端读取案件详情时获得的并发版本。 */
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}
