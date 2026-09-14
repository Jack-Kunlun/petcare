import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PaymentBillReviewService } from "./payment-bill-review.service";
import { PaymentBillService } from "./payment-bill.service";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
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
  providers: [
    WechatPayClient,
    PaymentService,
    RefundService,
    PaymentFeatureGuard,
    PaymentReconciliationService,
    PaymentBillService,
    PaymentBillReviewService,
  ],
  exports: [WechatPayClient],
})
export class PaymentModule {}
