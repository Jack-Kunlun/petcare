import { ApiProperty } from "@nestjs/swagger";
import type { CreateComplaintRequest } from "@petcare/shared-types";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsString, IsUrl, IsUUID, Length } from "class-validator";

/** 校验并描述用户创建投诉的请求。 */
export class CreateComplaintDto implements CreateComplaintRequest {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: "service_quality", maxLength: 50 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 50)
  complaintType: string;

  @ApiProperty({ minLength: 5, maxLength: 1000, example: "服务过程与约定不符" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(5, 1000)
  reason: string;

  @ApiProperty({
    type: [String],
    maxItems: 9,
    example: ["https://cdn.example/evidence.jpg"],
  })
  @IsArray()
  @ArrayMaxSize(9)
  @IsUrl({ require_protocol: true }, { each: true })
  evidenceUrls: string[];

  @ApiProperty({ minLength: 2, maxLength: 500, example: "申请部分退款" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 500)
  expectedSolution: string;
}
