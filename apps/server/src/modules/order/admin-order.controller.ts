import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AdminGuard } from "../../auth/admin.guard";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { AdminOrderListQueryDto } from "./dto/admin-order-list-query.dto";
import { AdminOrderListResponseDto } from "./dto/order-response.dto";
import { OrderService } from "./order.service";

@ApiTags("admin-orders")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AdminGuard)
@Controller("admin/orders")
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  /** 返回后台订单分页列表，查询参数已经由 DTO 完成转换与校验。 */
  @Get()
  @ApiOperation({ summary: "获取后台订单列表" })
  @ApiSuccessResponse(AdminOrderListResponseDto)
  @ApiStandardErrors(400, 401, 403, 500)
  findAll(@Query() query: AdminOrderListQueryDto) {
    return this.orderService.findAdminPage(query);
  }
}
