import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminProviderSummary,
  AdminUserListItem,
  AdminUserStatus,
  AdminUserType,
} from "@petcare/shared-types";

export class UserResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "17679141878" })
  phone: string;

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
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty()
  token: string;

  @ApiProperty()
  refreshToken: string;
}

export class AdminProviderSummaryDto implements AdminProviderSummary {
  @ApiProperty()
  idCardVerified: boolean;

  @ApiProperty()
  trainingPassed: boolean;

  @ApiProperty()
  certifiedSitter: boolean;
}

export class AdminUserListItemDto extends UserResponseDto implements AdminUserListItem {
  @ApiProperty({ type: AdminProviderSummaryDto, nullable: true })
  provider: AdminProviderSummaryDto | null;
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
