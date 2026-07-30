import { ApiProperty, PickType } from "@nestjs/swagger";
import type { SubmitComplaintStatementRequest } from "@petcare/shared-types";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
} from "class-validator";

/** 校验并描述首次回应或二次申诉请求。 */
export class SubmitComplaintStatementDto implements SubmitComplaintStatementRequest {
  @ApiProperty({
    maxLength: 1000,
    description: "陈述正文；二次申诉也可仅提交新的证据地址",
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  statement: string;

  @ApiProperty({ type: [String], maxItems: 9 })
  @IsArray()
  @ArrayMaxSize(9)
  @IsUrl({ require_protocol: true }, { each: true })
  evidenceUrls: string[];

  @ApiProperty({ minimum: 1, description: "详情接口返回的乐观并发版本号" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

/** 校验并描述被投诉方首次回应请求。 */
export class RespondComplaintDto extends SubmitComplaintStatementDto {
  @ApiProperty({ minLength: 2, maxLength: 1000 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 1000)
  declare statement: string;
}

/** 校验并描述撤回投诉请求。 */
export class WithdrawComplaintDto extends PickType(SubmitComplaintStatementDto, [
  "version",
] as const) {}
