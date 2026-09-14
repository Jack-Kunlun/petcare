import {
  Body,
  CanActivate,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import type {
  CreateOrderRefundRequest,
  OrderPaymentSummary,
  OrderPrepayResponse,
  OrderRefundSummary,
  PaymentReconciliationSummary,
  CreatePaymentBillRunRequest,
  PaymentBillRunSummary,
  PaymentBillRunDetail,
  CreatePaymentBillReviewRequest,
  PaymentBillReviewEntry,
  PaymentBillReviewHistory,
  PaymentBillReviewAction,
} from "@petcare/shared-types";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
  MinLength,
} from "class-validator";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { PermissionGuard } from "../../auth/permission.guard";
import { RequirePermissions } from "../../auth/permissions.decorator";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { RedisService } from "../../config/redis.service";
import { PaymentBillReviewService } from "./payment-bill-review.service";
import { PaymentBillService } from "./payment-bill.service";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { PaymentService } from "./payment.service";
import { RefundService } from "./refund.service";

type AuthRequest = Request & { user: AccessTokenPayload };

function notificationHeaders(req: Request): Headers {
  const headers = new Headers();

  for (const name of [
    "wechatpay-timestamp",
    "wechatpay-nonce",
    "wechatpay-signature",
    "wechatpay-serial",
    "wechatpay-signature-type",
  ]) {
    const value = req.headers[name];

    if (typeof value === "string") {
      headers.set(name, value);
    }
  }

  return headers;
}

async function limit(redis: RedisService, userId: string): Promise<void> {
  if (!(await redis.consumeFixedWindow(`payment:requests:${userId}`, 10, 60))) {
    throw new ApiException("PAYMENT_RATE_LIMITED", "支付请求过于频繁，请稍后查询", 429);
  }
}

@Injectable()
export class PaymentFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(): boolean {
    if (!this.config.wechatPay) {
      throw new ApiException("PAYMENT_NOT_FOUND", "支付服务未开放", 404);
    }

    return true;
  }
}

@Controller("payments")
@UseGuards(PaymentFeatureGuard)
export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    private readonly redis: RedisService,
    private readonly refunds: RefundService,
  ) {}

  @Post("orders/:orderId/prepay")
  @UseGuards(AccessTokenGuard, ProfileCompleteGuard)
  async prepay(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ): Promise<OrderPrepayResponse> {
    await limit(this.redis, req.user.sub);

    return this.payments.prepay(req.user.sub, orderId);
  }

  @Get("orders/:orderId")
  @UseGuards(AccessTokenGuard)
  findMine(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ): Promise<OrderPaymentSummary> {
    return this.payments.findMine(req.user.sub, orderId);
  }

  @Post("orders/:orderId/refresh")
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async refresh(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ): Promise<OrderPaymentSummary> {
    await limit(this.redis, req.user.sub);

    return this.payments.refresh(req.user.sub, orderId);
  }

  @Get("orders/:orderId/refund")
  @UseGuards(AccessTokenGuard)
  refundMine(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ): Promise<OrderRefundSummary> {
    return this.refunds.findMine(req.user.sub, orderId);
  }

  @Post("wechat/refund-notify")
  @HttpCode(204)
  async refundNotify(@Req() req: RawBodyRequest<Request>): Promise<void> {
    await this.refunds.notify(req.rawBody ?? Buffer.alloc(0), notificationHeaders(req));
  }

  @Post("wechat/notify")
  @HttpCode(204)
  async notify(@Req() req: RawBodyRequest<Request>): Promise<void> {
    await this.payments.notify(req.rawBody ?? Buffer.alloc(0), notificationHeaders(req));
  }
}

export class CreateOrderRefundDto implements CreateOrderRefundRequest {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class CreatePaymentBillRunDto implements CreatePaymentBillRunRequest {
  @IsUUID("4")
  idempotencyKey: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10)
  billDate: string;
}

export class CreatePaymentBillReviewDto implements CreatePaymentBillReviewRequest {
  @IsUUID("4")
  idempotencyKey: string;

  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  expectedVersion: number;

  @IsIn(["note", "record_outcome", "reopen"])
  action: PaymentBillReviewAction;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  note: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  evidenceReference?: string | null;
}

@Controller("admin/payments")
@UseGuards(PaymentFeatureGuard, AccessTokenGuard, PermissionGuard)
export class AdminRefundController {
  constructor(
    private readonly refunds: RefundService,
    private readonly redis: RedisService,
    private readonly reconciliation: PaymentReconciliationService,
    private readonly bills: PaymentBillService,
    private readonly billReviews: PaymentBillReviewService,
  ) {}

  @Post("bills/:runId/differences/:ordinal/reviews")
  @RequirePermissions("payment.bill_read", "payment.bill_review")
  async reviewBill(
    @Req() req: AuthRequest,
    @Param("runId", new ParseUUIDPipe({ version: "4" })) runId: string,
    @Param("ordinal", ParseIntPipe) ordinal: number,
    @Body() input: CreatePaymentBillReviewDto,
  ): Promise<PaymentBillReviewEntry> {
    await limit(this.redis, req.user.sub);

    return this.billReviews.append(req.user.sub, runId, ordinal, input);
  }

  @Get("bills/:runId/differences/:ordinal/reviews")
  @RequirePermissions("payment.bill_read")
  billReviewHistory(
    @Param("runId", new ParseUUIDPipe({ version: "4" })) runId: string,
    @Param("ordinal", ParseIntPipe) ordinal: number,
    @Query("after", new DefaultValuePipe(0), ParseIntPipe) after: number,
  ): Promise<PaymentBillReviewHistory> {
    return this.billReviews.history(runId, ordinal, after);
  }

  @Post("bills")
  @RequirePermissions("payment.bill_action")
  async runBill(
    @Req() req: AuthRequest,
    @Body() input: CreatePaymentBillRunDto,
  ): Promise<PaymentBillRunSummary> {
    await limit(this.redis, req.user.sub);

    return this.bills.run(req.user.sub, input);
  }

  @Get("bills")
  @RequirePermissions("payment.bill_read")
  recentBills(): Promise<PaymentBillRunSummary[]> {
    return this.bills.recent();
  }

  @Get("bills/:runId")
  @RequirePermissions("payment.bill_read")
  bill(
    @Param("runId", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query("after", new DefaultValuePipe(0), ParseIntPipe) after: number,
  ): Promise<PaymentBillRunDetail> {
    return this.bills.detail(id, after);
  }

  @Get("reconciliation")
  @RequirePermissions("payment.reconciliation_read")
  issues(): Promise<PaymentReconciliationSummary[]> {
    return this.reconciliation.issues();
  }

  @Post("orders/:orderId/refund")
  @RequirePermissions("payment.refund_action")
  async request(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
    @Body() input: CreateOrderRefundDto,
  ): Promise<OrderRefundSummary> {
    await limit(this.redis, req.user.sub);

    return this.refunds.request(req.user.sub, orderId, input.reason);
  }

  @Post("orders/:orderId/refund/refresh")
  @HttpCode(200)
  @RequirePermissions("payment.refund_read")
  async refresh(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ): Promise<OrderRefundSummary> {
    await limit(this.redis, req.user.sub);

    return this.refunds.refresh(orderId);
  }
}
