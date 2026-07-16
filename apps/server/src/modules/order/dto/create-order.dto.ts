// apps/api/src/modules/order/dto/create-order.dto.ts

import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional } from "class-validator";

export class CreateRewardOrderDto {
  @ApiProperty({ description: "服务类型", enum: ["feeding", "walking", "playing"] })
  @IsString()
  serviceType: string;

  @ApiProperty({ description: "宠物ID" })
  @IsString()
  petId: string;

  @ApiProperty({ description: "服务时间" })
  @IsString()
  serviceTime: string;

  @ApiProperty({ description: "悬赏金额" })
  @IsNumber()
  rewardAmount: number;

  @ApiProperty({ description: "服务地址" })
  @IsString()
  address: string;

  @ApiProperty({ description: "备注", required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
