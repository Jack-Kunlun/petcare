import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminAvatarResponse,
  AdminAccountProfile,
  UpdateAdminAccountPasswordRequest,
  UpdateAdminAccountProfileRequest,
} from "@petcare/shared-types";
import { IsString, MaxLength, MinLength } from "class-validator";

/** Validates the editable portion of an administrator's own profile. */
export class UpdateAdminAccountProfileDto implements UpdateAdminAccountProfileRequest {
  @ApiProperty({ minLength: 1, maxLength: 30, example: "值班管理员" })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  nickname: string;
}

/** Documents the safe fields returned by the current administrator profile endpoint. */
export class AdminAccountProfileDto implements AdminAccountProfile {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true })
  username: string | null;

  @ApiProperty({ example: "176****1878" })
  maskedPhone: string;

  @ApiProperty({ example: "值班管理员" })
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty({ example: "active" })
  status: string;

  @ApiProperty({ type: [String], example: ["operator"] })
  roles: string[];

  @ApiProperty({ format: "date-time" })
  createdAt: string;
}

/** Documents a multipart avatar upload body. The server validates the actual file bytes. */
export class UploadAdminAvatarDto {
  @ApiProperty({ type: "string", format: "binary" })
  file: string;
}

/** Documents the public URL returned after a validated avatar replacement. */
export class AdminAvatarResponseDto implements AdminAvatarResponse {
  @ApiProperty({ format: "uri", example: "https://cdn.example.com/public/admin-avatars/user/avatar.png" })
  avatar: string;
}

/** Validates a current password and its replacement for a self-service rotation. */
export class UpdateAdminAccountPasswordDto implements UpdateAdminAccountPasswordRequest {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  newPassword: string;
}
