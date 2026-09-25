import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OrderPaymentSummary, OrderPrepayResponse } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { OrderPayment, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { lockUserRow } from "../../prisma/user-row-lock";
import { WechatPayClient } from "./wechat-pay.client";

const conflict = () => new ApiException("PAYMENT_STATE_CONFLICT", "当前订单不允许支付", 409);
const invalidResult = () => new ApiException("PAYMENT_RESULT_INVALID", "支付结果校验失败", 400);
const notFound = () => new ApiException("PAYMENT_NOT_FOUND", "支付单不存在", 404);
const SIMULATED_MERCHANT_ID = "SIMULATED";
const SIMULATED_APP_ID = "SIMULATED";

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wechat: WechatPayClient,
  ) {}

  /** Persists the immutable merchant number before any external call; retries reuse this number. */
  async prepay(ownerId: string, orderId: string): Promise<OrderPrepayResponse> {
    const settings = this.settings();

    if (!this.config.commercialServicesEnabled) {
      throw notFound();
    }

    const payment = await this.createPendingPayment(
      ownerId,
      orderId,
      settings.merchantId,
      settings.appId,
    );

    // Network I/O must not hold database locks. An uncertain response leaves the payment pending.
    const parameters = await this.wechat.prepay({
      orderNumber: payment.id,
      amountCents: payment.amountCents,
      openId: payment.payerOpenId,
      description: "宠伴照护订单",
    });

    return { payment: this.summary(payment), parameters };
  }

  /** Marks a public order as simulated without calling a payment provider. */
  async simulate(ownerId: string, orderId: string): Promise<OrderPaymentSummary> {
    if (!this.config.paymentSimulationEnabled || this.config.wechatPay) {
      throw notFound();
    }

    if (!this.config.commercialServicesEnabled) {
      throw notFound();
    }

    const payment = await this.createPendingPayment(
      ownerId,
      orderId,
      SIMULATED_MERCHANT_ID,
      SIMULATED_APP_ID,
    );

    return this.summary(await this.applySimulatedResult(payment.id));
  }

  private async createPendingPayment(
    ownerId: string,
    orderId: string,
    merchantId: string,
    appId: string,
  ): Promise<OrderPayment> {
    return this.prisma
      .$transaction(async (tx) => {
        await this.lockOrder(tx, orderId);
        const order = await tx.order.findUnique({ where: { id: orderId } });

        if (!order || order.ownerId !== ownerId) {
          throw notFound();
        }

        if (
          order.orderType !== "reward" ||
          order.status !== "confirmed" ||
          !order.providerId ||
          order.providerId === ownerId ||
          order.serviceTime.getTime() <= Date.now() ||
          order.amount <= 0
        ) {
          throw conflict();
        }

        const owner = await lockUserRow(tx, ownerId);

        await lockUserRow(tx, order.providerId);
        const payer = await tx.user.findUnique({
          where: { id: ownerId },
          select: { openid: true },
        });
        const payerOpenId =
          payer?.openid ?? (merchantId === SIMULATED_MERCHANT_ID ? `simulated:${ownerId}` : null);
        const provider = await tx.user.findUnique({
          where: { id: order.providerId },
          include: { provider: true },
        });
        const approved = await tx.providerQualificationApplication.count({
          where: { applicantId: order.providerId, status: "approved" },
        });

        if (
          !owner ||
          owner.status !== "active" ||
          !owner.phone ||
          !payerOpenId ||
          provider?.status !== "active" ||
          !provider.phone ||
          provider.userType !== "provider" ||
          !provider.provider?.idCardVerified ||
          !provider.provider.trainingPassed ||
          !provider.provider.certifiedSitter ||
          !approved
        ) {
          throw conflict();
        }

        const existing = await tx.orderPayment.findUnique({ where: { orderId } });

        if (existing) {
          if (
            (existing.status !== "pending" &&
              !(merchantId === SIMULATED_MERCHANT_ID && existing.status === "simulated")) ||
            existing.amountCents !== order.amount ||
            existing.merchantId !== merchantId ||
            existing.appId !== appId ||
            existing.payerOpenId !== payerOpenId
          ) {
            throw conflict();
          }

          return existing;
        }

        return tx.orderPayment.create({
          data: {
            id: randomUUID().replaceAll("-", ""),
            orderId,
            amountCents: order.amount,
            merchantId,
            appId,
            payerOpenId,
          },
        });
      })
      .catch((error: unknown) => this.databaseError(error));
  }

  private async applySimulatedResult(paymentId: string): Promise<OrderPayment> {
    return this.prisma
      .$transaction(async (tx) => {
        const lookup = await tx.orderPayment.findUnique({ where: { id: paymentId } });

        if (!lookup || lookup.merchantId !== SIMULATED_MERCHANT_ID) {
          throw notFound();
        }

        await this.lockOrder(tx, lookup.orderId);
        const payment = await tx.orderPayment.findUniqueOrThrow({ where: { id: paymentId } });

        if (payment.status === "simulated") {
          return payment;
        }

        if (payment.status !== "pending") {
          throw conflict();
        }

        return tx.orderPayment.update({
          where: { id: payment.id },
          data: { status: "simulated" },
        });
      })
      .catch((error: unknown) => this.databaseError(error));
  }

  /** Reads only the authenticated owner's persisted payment, without making a provider request. */
  async findMine(ownerId: string, orderId: string): Promise<OrderPaymentSummary> {
    this.paymentFeatureSettings();
    const payment = await this.ownedPayment(ownerId, orderId);

    return this.summary(payment);
  }

  /** Reconciles an uncertain result using the original merchant number and the notification transaction. */
  async refresh(ownerId: string, orderId: string): Promise<OrderPaymentSummary> {
    this.paymentFeatureSettings();
    const payment = await this.ownedPayment(ownerId, orderId);

    if (payment.status === "simulated") {
      return this.summary(payment);
    }

    return this.reconcile(payment.id);
  }

  /** Internal read-only provider query; HTTP callers must pass ownership checks before using it. */
  async reconcile(paymentId: string): Promise<OrderPaymentSummary> {
    this.settings();
    const result = await this.wechat.query(paymentId);

    return this.summary(await this.applyVerifiedResult(result));
  }

  /** Acknowledgement is permitted only after authenticated event deduplication and payment commit. */
  async notify(rawBody: Buffer, headers: Headers): Promise<void> {
    this.settings();
    const notification = this.wechat.decodeNotification(rawBody, headers);

    if (
      notification.eventType !== "TRANSACTION.SUCCESS" ||
      notification.resource.trade_state !== "SUCCESS"
    ) {
      throw invalidResult();
    }

    await this.applyVerifiedResult(notification.resource, notification.id);
  }

  private settings() {
    const settings = this.config.wechatPay;

    if (!settings) {
      throw notFound();
    }

    return settings;
  }

  private paymentFeatureSettings() {
    const settings = this.config.wechatPay;

    if (!settings && !this.config.paymentSimulationEnabled) {
      throw notFound();
    }

    return settings;
  }

  private async ownedPayment(ownerId: string, orderId: string) {
    const payment = await this.prisma.orderPayment.findFirst({
      where: { orderId, order: { ownerId } },
    });

    if (!payment) {
      throw notFound();
    }

    return payment;
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
  }

  private async applyVerifiedResult(
    result: Record<string, unknown>,
    notificationId?: string,
  ): Promise<OrderPayment> {
    const settings = this.settings();

    if (typeof result.out_trade_no !== "string") {
      throw invalidResult();
    }

    const lookup = await this.prisma.orderPayment.findUnique({
      where: { id: result.out_trade_no },
    });

    if (!lookup) {
      throw notFound();
    }

    return this.prisma
      .$transaction(async (tx) => {
        // All payment and fulfillment writers serialize on the business order, including late callbacks.
        await this.lockOrder(tx, lookup.orderId);
        const payment = await tx.orderPayment.findUniqueOrThrow({ where: { id: lookup.id } });
        const amount = result.amount as Record<string, unknown> | undefined;
        const payer = result.payer as Record<string, unknown> | undefined;
        const state = result.trade_state;

        if (
          result.mchid !== payment.merchantId ||
          result.appid !== payment.appId ||
          payment.merchantId !== settings.merchantId ||
          payment.appId !== settings.appId ||
          !["NOTPAY", "CLOSED", "SUCCESS", "REFUND"].includes(String(state))
        ) {
          throw invalidResult();
        }

        const paid = state === "SUCCESS" || state === "REFUND";
        const paidAt =
          paid && typeof result.success_time === "string" ? new Date(result.success_time) : null;

        if (
          paid &&
          (result.trade_type !== "JSAPI" ||
            amount?.total !== payment.amountCents ||
            amount?.currency !== payment.currency ||
            payer?.openid !== payment.payerOpenId ||
            typeof result.transaction_id !== "string" ||
            !/^[a-zA-Z0-9_-]{1,32}$/.test(result.transaction_id) ||
            !paidAt ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
              result.success_time as string,
            ) ||
            !Number.isFinite(paidAt.getTime()) ||
            paidAt.getTime() < payment.createdAt.getTime() - 300_000 ||
            paidAt.getTime() > Date.now() + 300_000)
        ) {
          throw invalidResult();
        }

        if (
          paid &&
          payment.transactionId &&
          (payment.transactionId !== result.transaction_id ||
            payment.paidAt?.getTime() !== paidAt!.getTime())
        ) {
          throw invalidResult();
        }

        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify([
              payment.id,
              result.mchid,
              result.appid,
              state,
              result.transaction_id,
              paidAt?.toISOString(),
              amount?.total,
              amount?.currency,
              payer?.openid,
            ]),
          )
          .digest("hex");

        if (notificationId) {
          const previous = await tx.paymentNotification.findUnique({
            where: { id: notificationId },
          });

          if (previous) {
            if (previous.paymentId !== payment.id || previous.fingerprint !== fingerprint) {
              throw invalidResult();
            }

            return payment;
          }
        }

        let status = payment.status;

        if (state === "REFUND" && status !== "refunded") {
          status = "refund_pending";
        }

        if (state === "SUCCESS" && status !== "refund_pending" && status !== "refunded") {
          status = "succeeded";
        }

        if (state === "CLOSED" && status === "pending") {
          status = "closed";
        }

        const updated = await tx.orderPayment.update({
          where: { id: payment.id },
          data: {
            status,
            checkedAt: new Date(),
            ...(status === "closed" || status === "refunded"
              ? { reconcileIssue: null, reconcileFailures: 0 }
              : {}),
            ...(paid ? { transactionId: result.transaction_id as string, paidAt } : {}),
          },
        });

        if (notificationId) {
          await tx.paymentNotification.create({
            data: { id: notificationId, paymentId: payment.id, fingerprint },
          });
        }

        return updated;
      })
      .catch((error: unknown) => this.databaseError(error));
  }

  private databaseError(error: unknown): never {
    if (error instanceof ApiException) {
      throw error;
    }

    // Do not log Prisma input payloads containing the payer snapshot; callers can safely retry/query.
    throw new ApiException("PAYMENT_PERSISTENCE_UNAVAILABLE", "支付结果暂未确认，请稍后查询", 503);
  }

  private summary(payment: OrderPayment): OrderPaymentSummary {
    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      amountCents: payment.amountCents,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }
}
