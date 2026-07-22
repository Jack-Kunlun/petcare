import { ApiProperty } from "@nestjs/swagger";

export class CaptchaResponseDto {
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

export class AdminUserResponseDto {
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

export class AdminLoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: AdminUserResponseDto })
  user: AdminUserResponseDto;
}
