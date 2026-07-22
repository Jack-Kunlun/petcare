import { ApiProperty } from "@nestjs/swagger";
import { IsMobilePhone, IsString, Length, Matches } from "class-validator";

export class SendSmsCodeDto {
  @ApiProperty({ example: "17679141878" })
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
