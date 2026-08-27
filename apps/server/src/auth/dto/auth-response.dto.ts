import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminLoginResponse,
  AdminSessionUser,
  CaptchaChallenge,
  SendSmsCodeResponse,
} from "@petcare/shared-types";

export class CaptchaResponseDto implements CaptchaChallenge {
  @ApiProperty({ example: "0123456789abcdef0123456789abcdef" })
  captchaId: string;

  @ApiProperty({ example: "data:image/svg+xml;base64,..." })
  image: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;
}

export class SendSmsCodeResponseDto implements SendSmsCodeResponse {
  @ApiProperty({ example: "如果该手机号可用于后台登录，验证码将会发送" })
  message: string;

  @ApiProperty({ example: 60, minimum: 1 })
  cooldownSeconds: number;
}

export class AdminUserResponseDto implements AdminSessionUser {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true, example: "admin" })
  username: string | null;

  @ApiProperty({ example: "13800138000" })
  phone: string;

  @ApiProperty({ example: "系统管理员" })
  nickname: string;

  @ApiProperty({ nullable: true, example: "https://cdn.example.com/avatar.jpg" })
  avatar: string | null;

  @ApiProperty({ type: [String], example: ["super_admin"] })
  roles: string[];

  @ApiProperty({ type: [String], example: ["website.view", "website.publish"] })
  permissions: string[];
}

export class AdminLoginResponseDto implements AdminLoginResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: AdminUserResponseDto })
  user: AdminUserResponseDto;
}
