// apps/api/src/modules/order/order.controller.ts

import { Controller, Post, Body, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CreateRewardOrderDto } from "./dto/create-order.dto";
import { OrderService } from "./order.service";

@ApiTags("orders")
@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post("reward")
  @ApiOperation({ summary: "创建悬赏订单" })
  async createRewardOrder(@Body() dto: CreateRewardOrderDto) {
    // TODO: 从JWT中获取ownerId
    const ownerId = "mock-owner-id";

    return this.orderService.createRewardOrder(dto, ownerId);
  }

  @Get()
  @ApiOperation({ summary: "获取订单列表" })
  async findAll(@Query("page") page: number = 1, @Query("pageSize") pageSize: number = 20) {
    return this.orderService.findAll(page, pageSize);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取订单详情" })
  async findOne(@Param("id") id: string) {
    return this.orderService.findOne(id);
  }
}
