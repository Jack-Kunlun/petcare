import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminBountyOrderListResponse } from "@petcare/shared-types";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import { ApiSuccessResponse } from "../../common/swagger/api-response.decorators";
import { BountyFeatureGuard, BountyListQueryDto } from "./bounty.controller";
import { BountyService } from "./bounty.service";

/** Exposes reward orders to authorized PC operations users. */
@ApiTags("admin-bounties")
@ApiBearerAuth()
@UseGuards(BountyFeatureGuard, AccessTokenGuard, PermissionGuard)
@Controller("admin/bounties")
export class AdminBountyController {
  constructor(private readonly bounties: BountyService) {}

  @Get("orders")
  @RequirePermissions("bounty.order.read")
  @ApiOperation({ summary: "获取悬赏订单管理列表" })
  @ApiSuccessResponse(Object)
  findOrders(@Query() query: BountyListQueryDto): Promise<AdminBountyOrderListResponse> {
    return this.bounties.findAdminOrders(query);
  }
}
