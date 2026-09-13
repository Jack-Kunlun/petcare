import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { OrderRefundSummary } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { OrderRefund, OrderRefundStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WechatPayClient } from "./wechat-pay.client";

const notFound = () => new ApiException("REFUND_NOT_FOUND", "退款单不存在", 404);
const conflict = () => new ApiException("REFUND_STATE_CONFLICT", "当前订单不允许发起退款", 409);
const invalid = () => new ApiException("REFUND_RESULT_INVALID", "退款结果校验失败", 400);
const states = new Map<string, OrderRefundStatus>([
  ["PROCESSING", "processing"],
  ["SUCCESS", "succeeded"],
  ["ABNORMAL", "abnormal"],
  ["CLOSED", "closed"],
]);

function providerTime(value: unknown): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    )
  ) {
    throw invalid();
  }

  const date = new Date(value);
  const calendar = new Date(`${value.slice(0, 19)}Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 19) !== value.slice(0, 19)
  ) {
    throw invalid();
  }

  return date;
}

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wechat: WechatPayClient,
  ) {}

  /** Only permission-checked administrators may request a cancelled, unfulfilled order's full refund. */
  async request(actorId: string, orderId: string, reason: string): Promise<OrderRefundSummary> {
    const settings = this.settings();
    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      throw new ApiException("REFUND_INVALID_REASON", "请填写 5–500 字符退款原因", 400);
    }

    const refund = await this.prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { sops: true },
        });
        const payment = await tx.orderPayment.findUnique({ where: { orderId } });

        if (!order || !payment) {
          throw notFound();
        }

        if (
          order.orderType !== "reward" ||
          order.status !== "cancelled" ||
          order.completedAt ||
          order.sops.some(
            (step) => step.completedAt || step.photos.length > 0 || step.videos.length > 0,
          ) ||
          !payment.transactionId ||
          !payment.paidAt ||
          payment.amountCents <= 0 ||
          payment.merchantId !== settings.merchantId ||
          payment.appId !== settings.appId ||
          payment.currency !== "CNY"
        ) {
          throw conflict();
        }

        const existing = await tx.orderRefund.findUnique({ where: { paymentId: payment.id } });

        if (existing) {
          if (
            existing.reason !== normalizedReason ||
            existing.amountCents !== payment.amountCents
          ) {
            throw conflict();
          }

          return existing;
        }

        // A provider-side refund without a local record must be reconciled, never duplicated.
        if (payment.status !== "succeeded") {
          throw conflict();
        }

        const created = await tx.orderRefund.create({
          data: {
            id: randomUUID().replaceAll("-", ""),
            paymentId: payment.id,
            amountCents: payment.amountCents,
            requestedById: actorId,
            reason: normalizedReason,
          },
        });

        await tx.orderPayment.update({
          where: { id: payment.id },
          data: {
            status: "refund_pending",
            reconcileAfter: new Date(),
            reconcileIssue: null,
            reconcileFailures: 0,
          },
        });

        return created;
      })
      .catch((error: unknown) => this.databaseError(error));

    if (refund.status !== "pending") {
      return this.summary(refund, orderId);
    }

    // Persist and freeze fulfillment before network I/O. Uncertain retries use exactly the same number.
    const result = await this.wechat.refund({
      orderNumber: refund.paymentId,
      refundNumber: refund.id,
      totalCents: refund.amountCents,
      refundCents: refund.amountCents,
    });

    return this.applyVerifiedResult(result, refund.id);
  }

  /** Returns only the owner's refund status; does not expose administrative audit fields. */
  async findMine(ownerId: string, orderId: string): Promise<OrderRefundSummary> {
    this.settings();
    const refund = await this.prisma.orderRefund.findFirst({
      where: { payment: { orderId, order: { ownerId } } },
    });

    if (!refund) {
      throw notFound();
    }

    return this.summary(refund, orderId);
  }

  /** Permission-checked query can recover missed notifications, including after entry shutdown. */
  async refresh(orderId: string): Promise<OrderRefundSummary> {
    this.settings();
    const refund = await this.prisma.orderRefund.findFirst({ where: { payment: { orderId } } });

    if (!refund) {
      throw notFound();
    }

    return this.applyVerifiedResult(await this.wechat.queryRefund(refund.id), refund.id);
  }

  /** Authenticates raw bytes, then commits event deduplication and refund state together. */
  async notify(rawBody: Buffer, headers: Headers): Promise<void> {
    this.settings();
    const event = this.wechat.decodeNotification(rawBody, headers);
    const state = event.resource.refund_status;

    if (
      !["SUCCESS", "ABNORMAL", "CLOSED"].includes(String(state)) ||
      event.eventType !== `REFUND.${state}` ||
      typeof event.resource.out_refund_no !== "string"
    ) {
      throw invalid();
    }

    await this.applyVerifiedResult(event.resource, event.resource.out_refund_no, event.id);
  }

  private async applyVerifiedResult(
    result: Record<string, unknown>,
    refundId: string,
    notificationId?: string,
  ): Promise<OrderRefundSummary> {
    const settings = this.settings();
    const lookup = await this.prisma.orderRefund.findUnique({
      where: { id: refundId },
      include: { payment: { select: { orderId: true } } },
    });

    if (!lookup) {
      throw notFound();
    }

    return this.prisma
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${lookup.payment.orderId} FOR UPDATE`;
        const refund = await tx.orderRefund.findUniqueOrThrow({
          where: { id: refundId },
          include: { payment: true },
        });
        const payment = refund.payment;
        const state = notificationId ? result.refund_status : result.status;
        const amount = result.amount as Record<string, unknown> | undefined;
        const next = typeof state === "string" ? states.get(state) : undefined;

        if (
          !next ||
          result.out_refund_no !== refund.id ||
          result.out_trade_no !== payment.id ||
          !payment.transactionId ||
          result.transaction_id !== payment.transactionId ||
          payment.merchantId !== settings.merchantId ||
          payment.appId !== settings.appId ||
          (notificationId
            ? result.mchid !== payment.merchantId
            : result.mchid !== undefined && result.mchid !== payment.merchantId) ||
          typeof result.refund_id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,32}$/.test(result.refund_id) ||
          (refund.providerRefundId !== null && refund.providerRefundId !== result.refund_id) ||
          refund.amountCents !== payment.amountCents ||
          amount?.total !== payment.amountCents ||
          amount?.refund !== refund.amountCents ||
          (notificationId
            ? amount?.currency !== undefined && amount.currency !== payment.currency
            : amount?.currency !== payment.currency) ||
          !Number.isSafeInteger(amount?.payer_total) ||
          Number(amount?.payer_total) < 0 ||
          Number(amount?.payer_total) > payment.amountCents ||
          amount?.payer_refund !== amount?.payer_total ||
          (refund.payerRefundCents !== null && amount?.payer_refund !== refund.payerRefundCents)
        ) {
          throw invalid();
        }

        // Notifications carry creation time for the event, not refund acceptance.
        const acceptedAt = notificationId ? refund.acceptedAt : providerTime(result.create_time);

        if (
          acceptedAt &&
          (acceptedAt.getTime() < refund.createdAt.getTime() - 300_000 ||
            (payment.paidAt && acceptedAt.getTime() < payment.paidAt.getTime()) ||
            acceptedAt.getTime() > Date.now() + 300_000 ||
            (refund.acceptedAt && acceptedAt.getTime() !== refund.acceptedAt.getTime()) ||
            (refund.succeededAt && acceptedAt.getTime() > refund.succeededAt.getTime()))
        ) {
          throw invalid();
        }

        let succeededAt: Date | null = null;

        if (next === "succeeded") {
          succeededAt = providerTime(result.success_time);

          if (
            !Number.isFinite(succeededAt.getTime()) ||
            succeededAt.getTime() < refund.createdAt.getTime() - 300_000 ||
            succeededAt.getTime() > Date.now() + 300_000 ||
            (acceptedAt && succeededAt.getTime() < acceptedAt.getTime()) ||
            (refund.succeededAt && refund.succeededAt.getTime() !== succeededAt.getTime())
          ) {
            throw invalid();
          }
        }

        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify([
              "refund",
              refund.id,
              payment.id,
              payment.merchantId,
              result.transaction_id,
              result.refund_id,
              state,
              amount.total,
              amount.refund,
              amount.payer_total,
              amount.payer_refund,
              succeededAt?.toISOString(),
            ]),
          )
          .digest("hex");

        if (notificationId) {
          const previous = await tx.paymentNotification.findUnique({
            where: { id: notificationId },
          });

          if (previous) {
            if (previous.paymentId !== payment.id || previous.fingerprint !== fingerprint) {
              throw invalid();
            }

            return this.summary(refund, payment.orderId);
          }
        }

        let status = refund.status;

        // Success is irreversible; stale processing must not erase an abnormal/closed result.
        if (
          status !== "succeeded" &&
          (next === "succeeded" ||
            status === "pending" ||
            status === "processing" ||
            (status === "abnormal" && next === "closed"))
        ) {
          status = next;
        }

        const updated = await tx.orderRefund.update({
          where: { id: refund.id },
          data: {
            status,
            providerRefundId: result.refund_id,
            payerRefundCents: amount.payer_refund as number,
            ...(acceptedAt ? { acceptedAt } : {}),
            checkedAt: new Date(),
            ...(succeededAt ? { succeededAt } : {}),
          },
        });

        await tx.orderPayment.update({
          where: { id: payment.id },
          data: {
            status: status === "succeeded" ? "refunded" : "refund_pending",
            ...(status === "succeeded" ? { reconcileIssue: null, reconcileFailures: 0 } : {}),
            ...(status === "succeeded" && !acceptedAt ? { reconcileAfter: new Date() } : {}),
          },
        });

        if (notificationId) {
          await tx.paymentNotification.create({
            data: { id: notificationId, paymentId: payment.id, fingerprint },
          });
        }

        return this.summary(updated, payment.orderId);
      })
      .catch((error: unknown) => this.databaseError(error));
  }

  private settings() {
    const settings = this.config.wechatPay;

    if (!settings) {
      throw notFound();
    }

    return settings;
  }

  private databaseError(error: unknown): never {
    if (error instanceof ApiException) {
      throw error;
    }

    throw new ApiException("REFUND_PERSISTENCE_UNAVAILABLE", "退款结果暂未确认，请稍后查询", 503);
  }

  private summary(refund: OrderRefund, orderId: string): OrderRefundSummary {
    return {
      refundId: refund.id,
      paymentId: refund.paymentId,
      orderId,
      amountCents: refund.amountCents,
      status: refund.status,
      succeededAt: refund.succeededAt?.toISOString() ?? null,
    };
  }
}
