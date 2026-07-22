import { ApiProperty } from "@nestjs/swagger";
import { IsMobilePhone, IsString, Matches } from "class-validator";

export class SmsLoginDto {
  @ApiProperty({ example: "17679141878" })
  @IsMobilePhone("zh-CN")
  phone: string;

  @ApiProperty({ example: "246810" })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
