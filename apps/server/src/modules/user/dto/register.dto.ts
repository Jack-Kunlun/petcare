// apps/api/src/modules/user/dto/register.dto.ts

import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsMobilePhone, Length, IsOptional } from "class-validator";

export class RegisterDto {
  @ApiProperty({ description: "手机号" })
  @IsMobilePhone("zh-CN")
  phone: string;

  @ApiProperty({ description: "短信验证码" })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ description: "昵称" })
  @IsString()
  @Length(2, 20)
  nickname: string;

  @ApiProperty({ description: "头像URL", required: false })
  @IsOptional()
  @IsString()
  avatar?: string;
}
