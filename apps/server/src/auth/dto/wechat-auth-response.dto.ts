import { ApiProperty } from "@nestjs/swagger";
import type { MiniappUserProfile } from "@petcare/shared-types";

export class MiniappUserResponseDto implements MiniappUserProfile {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true, example: "138****8000" })
  phoneMasked: string | null;

  @ApiProperty()
  profileComplete: boolean;

  @ApiProperty({ example: "宠友1878" })
  nickname: string;

  @ApiProperty({ nullable: true, example: null })
  avatar: string | null;

  @ApiProperty({ example: "pet_owner" })
  userType: string;

  @ApiProperty({ nullable: true })
  region: string | null;

  @ApiProperty({ nullable: true })
  bio: string | null;
}

export class WechatSessionResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: MiniappUserResponseDto })
  user: MiniappUserResponseDto;
}
