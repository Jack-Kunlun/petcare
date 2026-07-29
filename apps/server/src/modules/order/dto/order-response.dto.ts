import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminOrderListItem,
  AdminOrderPetSummary,
  AdminOrderStatus,
  AdminOrderType,
  AdminOrderUserSummary,
  AdminServiceType,
} from "@petcare/shared-types";

export class OrderResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "reward" })
  orderType: AdminOrderType;

  @ApiProperty({ example: "feeding" })
  serviceType: AdminServiceType;

  @ApiProperty({ format: "uuid" })
  ownerId: string;

  @ApiProperty({ format: "uuid", nullable: true })
  providerId: string | null;

  @ApiProperty({ format: "uuid" })
  petId: string;

  @ApiProperty({ format: "date-time" })
  serviceTime: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ example: 80 })
  amount: number;

  @ApiProperty({ example: "pending_confirm" })
  status: AdminOrderStatus;

  @ApiProperty({ nullable: true })
  remark: string | null;

  @ApiProperty({ format: "date-time", nullable: true })
  completedAt: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}

export class CreateOrderResponseDto {
  @ApiProperty({ type: OrderResponseDto })
  order: OrderResponseDto;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] })
  list: OrderResponseDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

export class OrderOwnerResponseDto implements AdminOrderUserSummary {
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

export class AdminOrderPetSummaryDto implements AdminOrderPetSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "豆包" })
  name: string;

  @ApiProperty({ example: "英短" })
  breed: string;
}

export class AdminOrderListItemDto extends OrderResponseDto implements AdminOrderListItem {
  @ApiProperty({ type: OrderOwnerResponseDto })
  owner: OrderOwnerResponseDto;

  @ApiProperty({ type: OrderOwnerResponseDto, nullable: true })
  provider: OrderOwnerResponseDto | null;

  @ApiProperty({ type: AdminOrderPetSummaryDto })
  pet: AdminOrderPetSummaryDto;
}

export class AdminOrderListResponseDto {
  @ApiProperty({ type: [AdminOrderListItemDto] })
  list: AdminOrderListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
