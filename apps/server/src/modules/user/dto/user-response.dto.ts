import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminUserListItem,
  AdminUserStatus,
  AdminUserType,
  PublicUser,
  PublicUserProfile,
} from "@petcare/shared-types";

export class PublicUserProfileDto implements PublicUserProfile {
  @ApiProperty({ nullable: true, example: null })
  region: string | null;

  @ApiProperty({ nullable: true, example: "喜欢猫咪" })
  bio: string | null;
}

export class UserResponseDto implements PublicUser {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "小宠家长" })
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty({ example: "pet_owner" })
  userType: AdminUserType;

  @ApiProperty({ example: "active" })
  status: "active";

  @ApiProperty({ type: () => PublicUserProfileDto, nullable: true })
  profile: PublicUserProfileDto | null;
}

export class RegisteredUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true, example: "13800138000" })
  phone: string | null;

  @ApiProperty({ nullable: true, example: "pet_owner_1" })
  username: string | null;

  @ApiProperty({ example: "小宠家长" })
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty({ example: "pet_owner" })
  userType: AdminUserType;

  @ApiProperty({ example: "active" })
  status: AdminUserStatus;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

export class UserRegisterResponseDto {
  @ApiProperty({ type: RegisteredUserResponseDto })
  user: RegisteredUserResponseDto;

  @ApiProperty()
  token: string;

  @ApiProperty()
  refreshToken: string;
}

export class AdminUserListItemDto extends RegisteredUserResponseDto implements AdminUserListItem {}

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  list: AdminUserListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
