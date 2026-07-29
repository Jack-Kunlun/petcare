import { ApiProperty } from "@nestjs/swagger";
import type { SendSmsCodeRequest } from "@petcare/shared-types";
import { IsMobilePhone, IsString, Length, Matches } from "class-validator";

/** 校验发送登录短信验证码的请求。 */
export class SendSmsCodeDto implements SendSmsCodeRequest {
  @ApiProperty({ example: "13800138000" })
  @IsMobilePhone("zh-CN")
  phone: string;

  @ApiProperty({ example: "0123456789abcdef" })
  @IsString()
  @Length(16, 128)
  captchaId: string;

  @ApiProperty({ example: "2345" })
  @Matches(/^[2-9]{4}$/)
  captchaCode: string;
}
