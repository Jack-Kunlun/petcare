import { ApiProperty } from "@nestjs/swagger";
import type {
  BindMiniappPhoneRequest,
  MiniappUserProfile,
  SendMiniappPhoneCodeRequest,
  UpdateMiniappProfileRequest,
} from "@petcare/shared-types";
import { IsString, Matches, ValidateIf } from "class-validator";

/** Validates editable Miniapp profile fields; exact normalized lengths are enforced by the service. */
export class UpdateMiniappProfileDto implements UpdateMiniappProfileRequest {
  @ApiProperty({ minLength: 1, maxLength: 24, example: "小白家长" })
  @IsString()
  nickname: string;

  @ApiProperty({ nullable: true, maxLength: 80, example: "上海市" })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  region: string | null;

  @ApiProperty({ nullable: true, maxLength: 200, example: "喜欢猫咪" })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  bio: string | null;
}

/** Validates a destination for a Miniapp phone-binding code. */
export class SendMiniappPhoneCodeDto implements SendMiniappPhoneCodeRequest {
  @ApiProperty({ pattern: "^1[3-9][0-9]{9}$", example: "13800138000" })
  @Matches(/^1[3-9]\d{9}$/u)
  phone: string;
}

/** Validates the destination and code consumed by phone binding. */
export class BindMiniappPhoneDto implements BindMiniappPhoneRequest {
  @ApiProperty({ pattern: "^1[3-9][0-9]{9}$", example: "13800138000" })
  @Matches(/^1[3-9]\d{9}$/u)
  phone: string;

  @ApiProperty({ pattern: "^[0-9]{6}$", example: "123456" })
  @IsString()
  @Matches(/^\d{6}$/u)
  code: string;
}

/** Documents the current Miniapp user response without a raw phone number. */
export class MiniappUserProfileDto implements MiniappUserProfile {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "宠友123456" })
  nickname: string;

  @ApiProperty({ nullable: true, format: "uri" })
  avatar: string | null;

  @ApiProperty({ nullable: true, example: "138****8000" })
  phoneMasked: string | null;

  @ApiProperty()
  profileComplete: boolean;

  @ApiProperty({ example: "pet_owner" })
  userType: string;

  @ApiProperty({ nullable: true, example: "上海市" })
  region: string | null;

  @ApiProperty({ nullable: true, example: "喜欢猫咪" })
  bio: string | null;
}

/** Documents the single multipart avatar field. */
export class UploadMiniappAvatarDto {
  @ApiProperty({ type: "string", format: "binary" })
  file: string;
}
