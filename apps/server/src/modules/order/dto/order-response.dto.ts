import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminOrderListItem,
  AdminOrderPetSummary,
  AdminOrderStatus,
  AdminOrderType,
  AdminOrderUserSummary,
  AdminServiceType,
  OrderStatus,
  OrderType,
  PublicOrder,
  ServiceType,
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

export class PublicOrderOwnerResponseDto {
  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

export class PublicOrderPetResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  breed: string;

  @ApiProperty({ nullable: true })
  coverImage: string | null;
}

export class PublicOrderResponseDto implements PublicOrder {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "reward" })
  orderType: OrderType;

  @ApiProperty({ example: "feeding" })
  serviceType: ServiceType;

  @ApiProperty({ format: "date-time" })
  serviceTime: string;

  @ApiProperty({ example: 8000 })
  amount: number;

  @ApiProperty({ example: "pending_confirm" })
  status: OrderStatus;

  @ApiProperty({ type: PublicOrderOwnerResponseDto })
  owner: PublicOrderOwnerResponseDto;

  @ApiProperty({ type: PublicOrderPetResponseDto })
  pet: PublicOrderPetResponseDto;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [PublicOrderResponseDto] })
  list: PublicOrderResponseDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

export class OrderDetailResponseDto extends PublicOrderResponseDto {}

export class AdminOrderUserSummaryDto implements AdminOrderUserSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true, example: "13800138000" })
  phone: string | null;

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

export class AdminOrderPetSummaryDto implements AdminOrderPetSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ example: "豆包" })
  name: string;

  @ApiProperty({ example: "英短" })
  breed: string;
}

export class AdminOrderListItemDto extends OrderResponseDto implements AdminOrderListItem {
  @ApiProperty({ type: AdminOrderUserSummaryDto })
  owner: AdminOrderUserSummaryDto;

  @ApiProperty({ type: AdminOrderUserSummaryDto, nullable: true })
  provider: AdminOrderUserSummaryDto | null;

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
