import {
  CanActivate,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { OrderPaymentSummary, OrderPrepayResponse } from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { RedisService } from "../../config/redis.service";
import { PaymentService } from "./payment.service";

type AuthRequest = Request & { user: AccessTokenPayload };

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
  ) {}

  @Post("orders/:orderId/prepay")
  @UseGuards(AccessTokenGuard, ProfileCompleteGuard)
  async prepay(
    @Req() req: AuthRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ): Promise<OrderPrepayResponse> {
    await this.limit(req.user.sub);

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
    await this.limit(req.user.sub);

    return this.payments.refresh(req.user.sub, orderId);
  }

  private async limit(userId: string): Promise<void> {
    if (!(await this.redis.consumeFixedWindow(`payment:requests:${userId}`, 10, 60))) {
      throw new ApiException("PAYMENT_RATE_LIMITED", "支付请求过于频繁，请稍后查询", 429);
    }
  }

  @Post("wechat/notify")
  @HttpCode(204)
  async notify(@Req() req: RawBodyRequest<Request>): Promise<void> {
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

    await this.payments.notify(req.rawBody ?? Buffer.alloc(0), headers);
  }
}
