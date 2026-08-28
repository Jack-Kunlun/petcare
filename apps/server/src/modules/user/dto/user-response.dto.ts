import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminUserActivitySummary,
  AdminUserDetail,
  AdminUserDetailProfile,
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

export class AdminUserListItemFieldsDto {
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

export class AdminUserListItemDto extends AdminUserListItemFieldsDto implements AdminUserListItem {}

export class AdminUserDetailProfileDto implements AdminUserDetailProfile {
  @ApiProperty({ nullable: true, example: "喜欢记录和猫咪相处的日常" })
  bio: string | null;
}

export class AdminUserActivitySummaryDto implements AdminUserActivitySummary {
  @ApiProperty({ example: 2 })
  petCount: number;

  @ApiProperty({ example: 8 })
  postCount: number;

  @ApiProperty({ example: 16 })
  commentCount: number;

  @ApiProperty({ example: 5 })
  favoriteCount: number;
}

export class AdminUserDetailDto extends AdminUserListItemFieldsDto implements AdminUserDetail {
  @ApiProperty({ type: () => AdminUserDetailProfileDto, nullable: true })
  profile: AdminUserDetailProfileDto | null;

  @ApiProperty({ type: () => AdminUserActivitySummaryDto })
  activity: AdminUserActivitySummaryDto;
}

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
