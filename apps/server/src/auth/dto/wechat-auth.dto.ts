import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class WechatLoginDto {
  @ApiProperty({ example: "0a3X..." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  loginCode: string;
}

export class WechatRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  refreshToken: string;
}

export class WechatLogoutDto extends WechatRefreshDto {}
