import { ApiProperty } from "@nestjs/swagger";
import type {
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

  @ApiProperty({ example: "138****8000" })
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
