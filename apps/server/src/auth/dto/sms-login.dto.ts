import { ApiProperty } from "@nestjs/swagger";
import type { SmsLoginRequest } from "@petcare/shared-types";
import { IsMobilePhone, IsString, Matches } from "class-validator";

/** 校验管理员短信验证码登录请求。 */
export class SmsLoginDto implements SmsLoginRequest {
  @ApiProperty({ example: "13800138000" })
  @IsMobilePhone("zh-CN")
  phone: string;

  @ApiProperty({ example: "246810" })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
