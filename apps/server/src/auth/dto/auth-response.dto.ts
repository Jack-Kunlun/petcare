import { ApiProperty } from "@nestjs/swagger";
import type { AdminLoginResponse, AdminSessionUser, CaptchaChallenge } from "@petcare/shared-types";

export class CaptchaResponseDto implements CaptchaChallenge {
  @ApiProperty({ example: "0123456789abcdef0123456789abcdef" })
  captchaId: string;

  @ApiProperty({ example: "data:image/svg+xml;base64,..." })
  image: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;
}

export class MessageResponseDto {
  @ApiProperty({ example: "操作成功" })
  message: string;
}

export class AdminUserResponseDto implements AdminSessionUser {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true, example: "admin" })
  username: string | null;

  @ApiProperty({ example: "17679141878" })
  phone: string;

  @ApiProperty({ example: "系统管理员" })
  nickname: string;

  @ApiProperty({ type: [String], example: ["super_admin"] })
  roles: string[];
}

export class AdminLoginResponseDto implements AdminLoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: AdminUserResponseDto })
  user: AdminUserResponseDto;
}
