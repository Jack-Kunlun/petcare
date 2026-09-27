import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  AdminSettlementSummary,
  CreateProviderWithdrawalRequest,
  ProviderIncomeSummary,
  ProviderWithdrawalSummary,
} from "@petcare/shared-types";
import { IsInt, IsString, Matches, Max, Min } from "class-validator";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { BountyFeatureGuard } from "../bounty/bounty.controller";
import { SettlementService } from "./settlement.service";

type AuthRequest = Request & { user: AccessTokenPayload };

export class CreateProviderWithdrawalDto implements CreateProviderWithdrawalRequest {
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents: number;

  @IsString()
  @Matches(/^[0-9a-f-]{16,64}$/iu)
  idempotencyKey: string;
}

/** Exposes provider income and idempotent blocked withdrawal commands. */
@ApiTags("settlement")
@ApiBearerAuth()
@UseGuards(BountyFeatureGuard, AccessTokenGuard)
@Controller("settlement")
export class SettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Get("income")
  @ApiOperation({ summary: "获取服务者收入账务" })
  @ApiSuccessResponse(Object)
  @ApiStandardErrors(401, 404, 500)
  getIncome(@Req() request: AuthRequest): Promise<ProviderIncomeSummary> {
    return this.settlement.getProviderIncome(request.user.sub);
  }

  @Post("withdrawals")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "发起提现请求" })
  @ApiSuccessResponse(Object)
  @ApiStandardErrors(400, 401, 404, 409, 500)
  createWithdrawal(
    @Req() request: AuthRequest,
    @Body() dto: CreateProviderWithdrawalDto,
  ): Promise<ProviderWithdrawalSummary> {
    return this.settlement.createWithdrawal(request.user.sub, dto);
  }
}

/** Exposes aggregate settlement state to authorized PC operations users. */
@ApiTags("admin-settlement")
@ApiBearerAuth()
@UseGuards(BountyFeatureGuard, AccessTokenGuard, PermissionGuard)
@Controller("admin/settlement")
export class AdminSettlementController {
  constructor(private readonly settlement: SettlementService) {}

  @Get("summary")
  @RequirePermissions("settlement.operations.view")
  @ApiOperation({ summary: "获取结算运营汇总" })
  @ApiSuccessResponse(Object)
  @ApiStandardErrors(401, 403, 404, 500)
  getSummary(): Promise<AdminSettlementSummary> {
    return this.settlement.getAdminSummary();
  }
}
