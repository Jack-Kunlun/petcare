import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { CreateRewardOrderDto } from "./dto/create-order.dto";
import { OrderListQueryDto } from "./dto/order-list-query.dto";
import {
  CreateOrderResponseDto,
  OrderDetailResponseDto,
  OrderListResponseDto,
} from "./dto/order-response.dto";
import { OrderService } from "./order.service";

@ApiTags("orders")
@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post("reward")
  @ApiOperation({ summary: "创建悬赏订单" })
  @ApiSuccessResponse(CreateOrderResponseDto, { status: 201 })
  @ApiStandardErrors(400, 404, 500)
  createRewardOrder(@Body() dto: CreateRewardOrderDto) {
    // TODO: 从 JWT 中获取 ownerId。
    const ownerId = "mock-owner-id";

    return this.orderService.createRewardOrder(dto, ownerId);
  }

  @Get()
  @ApiOperation({ summary: "获取订单列表" })
  @ApiSuccessResponse(OrderListResponseDto)
  @ApiStandardErrors(400, 500)
  findAll(@Query() query: OrderListQueryDto) {
    return this.orderService.findAll(query.page, query.pageSize);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取订单详情" })
  @ApiSuccessResponse(OrderDetailResponseDto)
  @ApiStandardErrors(404, 500)
  findOne(@Param("id") id: string) {
    return this.orderService.findOne(id);
  }
}
