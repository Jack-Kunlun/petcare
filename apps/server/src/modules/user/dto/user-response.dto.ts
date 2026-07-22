import { ApiProperty } from "@nestjs/swagger";

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
  userType: string;

  @ApiProperty({ example: "active" })
  status: string;

  @ApiProperty({ format: "date-time" })
  createdAt: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt: Date;
}

export class UserRegisterResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty()
  token: string;

  @ApiProperty()
  refreshToken: string;
}
