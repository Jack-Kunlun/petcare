import { Module } from "@nestjs/common";
import { WechatPayClient } from "./wechat-pay.client";

@Module({ providers: [WechatPayClient], exports: [WechatPayClient] })
export class PaymentModule {}
