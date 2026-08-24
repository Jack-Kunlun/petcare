import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
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

type AuthRequest = Request & { user: AccessTokenPayload };

@ApiTags("orders")
@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post("reward")
  @UseGuards(AccessTokenGuard, ProfileCompleteGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建悬赏订单" })
  @ApiSuccessResponse(CreateOrderResponseDto, { status: 201 })
  @ApiStandardErrors(400, 401, 403, 404, 500)
  createRewardOrder(@Req() request: AuthRequest, @Body() dto: CreateRewardOrderDto) {
    return this.orderService.createRewardOrder(dto, request.user.sub);
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
