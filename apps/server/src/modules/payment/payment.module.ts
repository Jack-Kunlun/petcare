import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import {
  AdminRefundController,
  PaymentController,
  PaymentFeatureGuard,
} from "./payment.controller";
import { PaymentService } from "./payment.service";
import { RefundService } from "./refund.service";
import { WechatPayClient } from "./wechat-pay.client";

@Module({
  imports: [AuthModule],
  controllers: [PaymentController, AdminRefundController],
  providers: [WechatPayClient, PaymentService, RefundService, PaymentFeatureGuard],
  exports: [WechatPayClient],
})
export class PaymentModule {}
