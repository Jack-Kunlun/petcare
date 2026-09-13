import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PaymentController, PaymentFeatureGuard } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { WechatPayClient } from "./wechat-pay.client";

@Module({
  imports: [AuthModule],
  controllers: [PaymentController],
  providers: [WechatPayClient, PaymentService, PaymentFeatureGuard],
  exports: [WechatPayClient],
})
export class PaymentModule {}
