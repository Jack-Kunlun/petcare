import { ApiProperty } from "@nestjs/swagger";

export class MiniappUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "17679141878" })
  phone: string;

  @ApiProperty({ example: "宠友1878" })
  nickname: string;

  @ApiProperty({ nullable: true, example: null })
  avatar: string | null;

  @ApiProperty({ example: "pet_owner" })
  userType: string;
}

export class WechatSessionResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: MiniappUserResponseDto })
  user: MiniappUserResponseDto;
}

export class WechatAuthenticatedResponseDto extends WechatSessionResponseDto {
  @ApiProperty({ enum: ["authenticated"], example: "authenticated" })
  status: "authenticated";
}

export class WechatPhoneRequiredResponseDto {
  @ApiProperty({ enum: ["phone_required"], example: "phone_required" })
  status: "phone_required";

  @ApiProperty()
  bindToken: string;
}

export class WechatLoginResponseDto {
  @ApiProperty({
    enum: ["authenticated", "phone_required"],
    example: "authenticated",
  })
  status: "authenticated" | "phone_required";

  @ApiProperty({ required: false })
  bindToken?: string;

  @ApiProperty({ required: false })
  accessToken?: string;

  @ApiProperty({ required: false })
  refreshToken?: string;

  @ApiProperty({ type: MiniappUserResponseDto, required: false })
  user?: MiniappUserResponseDto;
}
