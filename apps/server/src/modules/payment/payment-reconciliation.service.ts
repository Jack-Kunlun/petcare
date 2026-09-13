import { randomUUID } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { PaymentReconciliationSummary } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { PaymentReconciliationIssue } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentService } from "./payment.service";
import { RefundService } from "./refund.service";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Queries existing merchant numbers only; never initiates a payment, refund, cancellation or ledger entry. */
@Injectable()
export class PaymentReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: PaymentService,
    private readonly refunds: RefundService,
  ) {}

  onModuleInit(): void {
    if (!this.config.paymentReconciliationEnabled) {
      return;
    }

    this.tick();
    this.timer = setInterval(() => this.tick(), MINUTE);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;

    if (this.timer) {
      clearInterval(this.timer);
    }

    await this.running?.catch(() => undefined);
  }

  private tick(): void {
    void this.runOnce().catch(() => this.logger.error("Payment reconciliation scan will retry"));
  }

  /** Bounded scan shared by the timer and isolated verification; disabled configuration does no I/O. */
  runOnce(): Promise<number> {
    if (
      this.stopped ||
      this.running ||
      !this.config.paymentReconciliationEnabled ||
      !this.config.wechatPay
    ) {
      return Promise.resolve(0);
    }

    this.running = this.scan();

    return this.running.finally(() => {
      this.running = undefined;
    });
  }

  /** Permission-checked read of at most 50 outstanding issues; excludes payer and merchant credentials. */
  async issues(): Promise<PaymentReconciliationSummary[]> {
    const rows = await this.prisma.orderPayment.findMany({
      where: { reconcileIssue: { not: null } },
      orderBy: [{ reconcileAfter: "asc" }, { id: "asc" }],
      take: 50,
      select: {
        id: true,
        orderId: true,
        amountCents: true,
        status: true,
        checkedAt: true,
        reconcileIssue: true,
        reconcileFailures: true,
        reconcileAfter: true,
        refund: { select: { status: true } },
      },
    });

    return rows.map((row) => ({
      paymentId: row.id,
      orderId: row.orderId,
      amountCents: row.amountCents,
      paymentStatus: row.status,
      refundStatus: row.refund?.status ?? null,
      issue: row.reconcileIssue!,
      consecutiveFailures: row.reconcileFailures,
      nextCheckAt: row.reconcileAfter.toISOString(),
      paymentCheckedAt: row.checkedAt?.toISOString() ?? null,
    }));
  }

  private async scan(): Promise<number> {
    const candidates = await this.prisma.orderPayment.findMany({
      where: {
        status: { in: ["pending", "succeeded", "refund_pending"] },
        reconcileAfter: { lte: new Date() },
        OR: [{ reconcileLeaseUntil: null }, { reconcileLeaseUntil: { lte: new Date() } }],
      },
      orderBy: [{ reconcileAfter: "asc" }, { id: "asc" }],
      take: 10,
      select: { id: true },
    });
    let processed = 0;

    for (const candidate of candidates) {
      if (this.stopped || !this.config.paymentReconciliationEnabled || !this.config.wechatPay) {
        break;
      }

      try {
        // Each item receives its lease immediately before I/O, not at the start of a slow batch.
        // eslint-disable-next-line no-await-in-loop
        processed += await this.process(candidate.id);
      } catch {
        // Persisted lease expiry recovers crashes and DB failures without releasing another worker's lease.
        this.logger.error("Payment reconciliation item will retry after lease expiry");
      }
    }

    return processed;
  }

  private async process(paymentId: string): Promise<number> {
    const token = randomUUID();
    // Database time controls lease exclusivity across hosts with different local clocks.
    const claimed = await this.prisma.$queryRaw<Array<{ id: string }>>`
      UPDATE "order_payments"
      SET "reconcile_lease_token" = ${token}, "reconcile_lease_until" = CURRENT_TIMESTAMP + INTERVAL '2 minutes'
      WHERE "id" = ${paymentId} AND "reconcile_after" <= CURRENT_TIMESTAMP
        AND "status" IN ('pending', 'succeeded', 'refund_pending')
        AND ("reconcile_lease_until" IS NULL OR "reconcile_lease_until" <= CURRENT_TIMESTAMP)
      RETURNING "id"`;

    if (claimed.length === 0) {
      return 0;
    }

    const payment = await this.prisma.orderPayment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { refund: { select: { id: true } } },
    });
    let errorCode: PaymentReconciliationIssue | null = null;

    try {
      const settings = this.config.wechatPay;

      if (
        !settings ||
        payment.merchantId !== settings.merchantId ||
        payment.appId !== settings.appId
      ) {
        throw new ApiException("PAYMENT_RESULT_INVALID", "支付配置与原交易不匹配", 400);
      }

      if (payment.status !== "closed" && payment.status !== "refunded") {
        if (payment.refund) {
          await this.refunds.refresh(payment.orderId);
        } else {
          await this.payments.reconcile(payment.id);
        }
      }
    } catch (error) {
      errorCode =
        error instanceof ApiException &&
        ["PAYMENT_RESULT_INVALID", "REFUND_RESULT_INVALID"].includes(error.code)
          ? "result_invalid"
          : "query_failed";
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${payment.orderId} FOR UPDATE`;
      const current = await tx.orderPayment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { refund: true, order: { select: { status: true } } },
      });

      if (current.reconcileLeaseToken !== token) {
        return 0;
      }

      const now = Date.now();
      const terminal = current.status === "closed" || current.status === "refunded";
      const failures = !terminal && errorCode ? Math.min(current.reconcileFailures + 1, 1000) : 0;
      let issue: PaymentReconciliationIssue | null = null;
      let delay = MINUTE;

      if (!terminal) {
        if (current.refund?.status === "abnormal") {
          issue = "refund_abnormal";
        } else if (current.refund?.status === "closed") {
          issue = "refund_closed";
        } else if (current.status === "refund_pending" && !current.refund) {
          issue = "external_refund";
        } else if (current.status === "succeeded" && current.order.status === "cancelled") {
          issue = "cancelled_payment";
        } else if (errorCode === "result_invalid" || failures >= 3) {
          issue = errorCode;
        } else if (current.refund && now - current.refund.createdAt.getTime() >= DAY) {
          issue = "refund_pending_too_long";
        } else if (current.status === "pending" && now - current.createdAt.getTime() >= DAY) {
          issue = "payment_pending_too_long";
        }

        const createdAt = current.refund?.createdAt ?? current.createdAt;

        if (errorCode) {
          delay = Math.min(2 ** Math.min(failures, 6), 60) * MINUTE;
        } else if (current.status === "succeeded" || issue) {
          delay = 60 * MINUTE;
        } else if (now - createdAt.getTime() >= 60 * MINUTE) {
          delay = 30 * MINUTE;
        } else if (now - createdAt.getTime() >= 5 * MINUTE) {
          delay = 5 * MINUTE;
        }
      }

      const updated = await tx.orderPayment.updateMany({
        where: { id: paymentId, reconcileLeaseToken: token },
        data: {
          reconcileAfter: new Date(now + delay),
          reconcileFailures: failures,
          reconcileIssue: issue,
          reconcileLeaseToken: null,
          reconcileLeaseUntil: null,
        },
      });

      if (updated.count > 0 && issue && issue !== current.reconcileIssue) {
        this.logger.warn(`Payment reconciliation requires review: ${issue}`);
      }

      return updated.count;
    });
  }
}
