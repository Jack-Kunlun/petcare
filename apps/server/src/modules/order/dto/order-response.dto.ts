import { ApiProperty } from "@nestjs/swagger";

export class OrderResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "reward" })
  orderType: string;

  @ApiProperty({ example: "feeding" })
  serviceType: string;

  @ApiProperty({ format: "uuid" })
  ownerId: string;

  @ApiProperty({ format: "uuid", nullable: true })
  providerId: string | null;

  @ApiProperty({ format: "uuid" })
  petId: string;

  @ApiProperty({ format: "date-time" })
  serviceTime: Date;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: 80 })
  amount: number;

  @ApiProperty({ example: "pending_confirm" })
  status: string;

  @ApiProperty({ nullable: true })
  remark: string | null;

  @ApiProperty({ format: "date-time", nullable: true })
  completedAt: Date | null;

  @ApiProperty({ format: "date-time" })
  createdAt: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt: Date;
}

export class CreateOrderResponseDto {
  @ApiProperty({ type: OrderResponseDto })
  order: OrderResponseDto;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  orders: OrderResponseDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

export class OrderOwnerResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "17679141878" })
  phone: string;

  @ApiProperty({ nullable: true })
  username: string | null;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty({ example: "pet_owner" })
  userType: string;

  @ApiProperty({ example: "active" })
  status: string;
}

export class OrderPetResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  ownerId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  breed: string;

  @ApiProperty()
  age: number;

  @ApiProperty({ nullable: true })
  weight: number | null;

  @ApiProperty({ example: "male" })
  gender: string;

  @ApiProperty()
  sterilized: boolean;

  @ApiProperty({ nullable: true })
  habits: string | null;

  @ApiProperty({ nullable: true })
  allergies: string | null;

  @ApiProperty({ type: [String] })
  photos: string[];

  @ApiProperty({ format: "date-time" })
  createdAt: Date;

  @ApiProperty({ format: "date-time" })
  updatedAt: Date;
}

export class OrderDetailResponseDto extends OrderResponseDto {
  @ApiProperty({ type: OrderOwnerResponseDto })
  owner: OrderOwnerResponseDto;

  @ApiProperty({ type: OrderPetResponseDto })
  pet: OrderPetResponseDto;
}
