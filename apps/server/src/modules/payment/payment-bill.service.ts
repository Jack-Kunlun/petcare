import { Injectable } from "@nestjs/common";
import type {
  CreatePaymentBillRunRequest,
  PaymentBillDifferenceSummary,
  PaymentBillEntry,
  PaymentBillRunDetail,
  PaymentBillRunSummary,
  PaymentBillRunPage,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import {
  Prisma,
  type OrderPayment,
  type OrderRefund,
  type PaymentBillRun,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WechatPayClient } from "./wechat-pay.client";
import { validateBillDate } from "./wechat-trade-bill";

type Bill = Awaited<ReturnType<WechatPayClient["tradeBill"]>>;
type LocalPayment = OrderPayment & { refund: OrderRefund | null };
const LOCAL_LIMIT = 20_000;
const unavailable = () => new ApiException("PAYMENT_BILL_UNAVAILABLE", "账单核对暂不可用", 503);
const notFound = () => new ApiException("PAYMENT_BILL_NOT_FOUND", "账单核对记录不存在", 404);

function localEntry(payment: LocalPayment, refund = false): PaymentBillEntry {
  return {
    eventType: refund ? "REFUND" : "SUCCESS",
    tradeType: "JSAPI",
    subMerchantId: "0",
    currency: payment.currency,
    paymentId: payment.id,
    refundId: refund ? payment.refund!.id : null,
    transactionId: payment.transactionId,
    providerRefundId: refund ? payment.refund!.providerRefundId : null,
    appId: payment.appId,
    amountCents: refund ? payment.refund!.amountCents : payment.amountCents,
    occurredAt: (refund ? payment.refund!.acceptedAt : payment.paidAt)?.toISOString() ?? null,
  };
}

/** Two-way snapshot comparison only; bill refund state is historical, never a current-state command. */
export function comparePaymentBill(
  bill: Bill,
  payments: LocalPayment[],
): PaymentBillDifferenceSummary[] {
  const start = new Date(`${bill.billDate}T00:00:00+08:00`).getTime();
  const end = start + 86_400_000;
  const inDay = (time: Date | null) =>
    time !== null && time.getTime() >= start && time.getTime() < end;
  const local = new Map(payments.map((payment) => [payment.id, payment]));
  const refunds = new Map(
    payments.filter((payment) => payment.refund).map((payment) => [payment.refund!.id, payment]),
  );
  const seenPayments = new Set<string>();
  const seenRefunds = new Set<string>();
  const differences: PaymentBillDifferenceSummary[] = [];
  const add = (
    code: PaymentBillDifferenceSummary["code"],
    fields: string[],
    before: PaymentBillEntry | null,
    after: PaymentBillEntry | null,
  ) => {
    differences.push({
      ordinal: differences.length + 1,
      code,
      fields,
      local: before,
      provider: after,
    });
  };

  for (const row of bill.rows) {
    const refund = row.status !== "SUCCESS";
    const payment = refund ? refunds.get(row.refundId!) : local.get(row.paymentId);
    const provider: PaymentBillEntry = {
      eventType: row.status,
      tradeType: row.tradeType,
      subMerchantId: row.subMerchantId,
      currency: "CNY",
      paymentId: row.paymentId,
      refundId: row.refundId,
      transactionId: row.transactionId,
      providerRefundId: row.providerRefundId,
      appId: row.appId,
      amountCents: refund ? row.refundCents : row.amountCents,
      occurredAt: row.occurredAt,
    };

    if (refund) {
      seenRefunds.add(row.refundId!);
    } else {
      seenPayments.add(row.paymentId);
    }

    if (!payment) {
      add("local_missing", [], null, provider);
      continue;
    }

    const before = localEntry(payment, refund);
    const fields = (
      [
        "paymentId",
        "transactionId",
        "providerRefundId",
        "appId",
        "amountCents",
        "currency",
        "subMerchantId",
        "tradeType",
        "eventType",
      ] as const
    ).filter((field) => before[field] !== provider[field]) as string[];

    // The bill has second precision while persisted API timestamps can have milliseconds.
    if (
      !before.occurredAt ||
      Math.floor(Date.parse(before.occurredAt) / 1000) !==
        Math.floor(Date.parse(row.occurredAt) / 1000)
    ) {
      fields.push("occurredAt");
    }

    if (fields.length > 0) {
      add("fields_mismatch", fields, before, provider);
    }
  }

  for (const payment of payments) {
    if (inDay(payment.paidAt) && !seenPayments.has(payment.id)) {
      add("provider_missing", [], localEntry(payment), null);
    }

    const refund = payment.refund;

    if (!refund) {
      continue;
    }

    if (inDay(refund.acceptedAt) && !seenRefunds.has(refund.id)) {
      add("provider_missing", [], localEntry(payment, true), null);
    } else if (!refund.acceptedAt && refund.createdAt.getTime() < end) {
      add("refund_time_unknown", ["occurredAt"], localEntry(payment, true), null);
    }
  }

  return differences;
}

@Injectable()
export class PaymentBillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wechat: WechatPayClient,
  ) {}

  private merchantId(): string {
    const settings = this.config.wechatPay;

    if (!settings) {
      throw notFound();
    }

    return settings.merchantId;
  }

  /** Persist intent before I/O; repeats return the original run, including an interrupted running run. */
  async run(actorId: string, input: CreatePaymentBillRunRequest): Promise<PaymentBillRunSummary> {
    const merchantId = this.merchantId();

    validateBillDate(input.billDate);

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.idempotencyKey,
      )
    ) {
      throw new ApiException("PAYMENT_BILL_REQUEST_INVALID", "核对请求标识无效", 400);
    }

    const id = input.idempotencyKey.toLowerCase();

    try {
      await this.prisma.paymentBillRun.create({
        data: { id, merchantId, billDate: input.billDate, requestedById: actorId },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw unavailable();
      }

      const existing = await this.prisma.paymentBillRun.findUnique({ where: { id } });

      if (
        !existing ||
        existing.merchantId !== merchantId ||
        existing.billDate !== input.billDate ||
        existing.requestedById !== actorId
      ) {
        throw new ApiException("PAYMENT_BILL_REQUEST_CONFLICT", "核对请求标识已用于其他请求", 409);
      }

      return this.summary(existing);
    }

    try {
      const bill = await this.wechat.tradeBill(input.billDate);
      const start = new Date(`${input.billDate}T00:00:00+08:00`);
      const end = new Date(start.getTime() + 86_400_000);
      const completed = await this.prisma.$transaction(
        async (tx) => {
          const [{ at }] = await tx.$queryRaw<Array<{ at: Date }>>`SELECT CURRENT_TIMESTAMP AS at`;
          const payments = await tx.orderPayment.findMany({
            where: {
              merchantId,
              OR: [
                { id: { in: bill.rows.map((row) => row.paymentId) } },
                { paidAt: { gte: start, lt: end } },
                {
                  refund: {
                    is: {
                      OR: [
                        {
                          id: {
                            in: bill.rows.flatMap((row) => (row.refundId ? [row.refundId] : [])),
                          },
                        },
                        { acceptedAt: { gte: start, lt: end } },
                        { acceptedAt: null, createdAt: { lt: end } },
                      ],
                    },
                  },
                },
              ],
            },
            include: { refund: true },
            orderBy: { id: "asc" },
            take: LOCAL_LIMIT + 1,
          });

          if (payments.length > LOCAL_LIMIT) {
            throw new ApiException("PAYMENT_BILL_LIMIT_EXCEEDED", "本地核对记录超出单次上限", 503);
          }

          const differences = comparePaymentBill(bill, payments);

          // Bound each insert below PostgreSQL's parameter limit; commit all differences atomically.
          for (let offset = 0; offset < differences.length; offset += 500) {
            // eslint-disable-next-line no-await-in-loop
            await tx.paymentBillDifference.createMany({
              data: differences.slice(offset, offset + 500).map((entry) => ({
                runId: id,
                ordinal: entry.ordinal,
                code: entry.code,
                fields: entry.fields,
                local: entry.local ? { ...entry.local } : Prisma.DbNull,
                provider: entry.provider ? { ...entry.provider } : Prisma.DbNull,
              })),
            });
          }

          return tx.paymentBillRun.update({
            where: { id },
            data: {
              status: differences.length > 0 ? "differences" : "matched",
              fileSha256: bill.sha256,
              rowCount: bill.rowCount,
              localCount: payments.length,
              differenceCount: differences.length,
              snapshotAt: at,
              finishedAt: new Date(),
            },
          });
        },
        { isolationLevel: "RepeatableRead", timeout: 30_000 },
      );

      return this.summary(completed);
    } catch (error) {
      const failureCode =
        error instanceof ApiException && error.code === "PAYMENT_BILL_LIMIT_EXCEEDED"
          ? error.code
          : "PAYMENT_BILL_UNAVAILABLE";

      try {
        // A commit with an uncertain response must never be overwritten as a failed run.
        await this.prisma.paymentBillRun.updateMany({
          where: { id, status: "running" },
          data: { status: "failed", failureCode, finishedAt: new Date() },
        });

        return this.summary(await this.prisma.paymentBillRun.findUniqueOrThrow({ where: { id } }));
      } catch {
        throw unavailable();
      }
    }
  }

  /** Latest 20 runs, including failures and interrupted attempts; financial records remain untouched. */
  async recent(): Promise<PaymentBillRunSummary[]> {
    return (
      await this.prisma.paymentBillRun.findMany({
        where: { merchantId: this.merchantId() },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
      })
    ).map((run) => this.summary(run));
  }

  /** Complete merchant-scoped history; a cursor never hides older failed or interrupted runs. */
  async history(after?: string): Promise<PaymentBillRunPage> {
    const merchantId = this.merchantId();
    const cursor = after
      ? await this.prisma.paymentBillRun.findFirst({
          where: { id: after.toLowerCase(), merchantId },
        })
      : null;

    if (after && !cursor) {
      throw notFound();
    }

    const rows = await this.prisma.paymentBillRun.findMany({
      where: {
        merchantId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    });

    return {
      list: rows.slice(0, 20).map((run) => this.summary(run)),
      nextCursor: rows.length > 20 ? rows[19].id : null,
    };
  }

  /** Stable cursor pagination over immutable differences; no truncation of the run's total count. */
  async detail(id: string, after: number): Promise<PaymentBillRunDetail> {
    if (!Number.isSafeInteger(after) || after < 0 || after > 2_147_483_647) {
      throw new ApiException("PAYMENT_BILL_REQUEST_INVALID", "分页参数无效", 400);
    }

    const run = await this.prisma.paymentBillRun.findFirst({
      where: { id: id.toLowerCase(), merchantId: this.merchantId() },
    });

    if (!run) {
      throw notFound();
    }

    const rows =
      run.status === "differences"
        ? await this.prisma.paymentBillDifference.findMany({
            where: { runId: run.id, ordinal: { gt: after } },
            orderBy: { ordinal: "asc" },
            take: 51,
          })
        : [];

    return {
      run: this.summary(run),
      nextCursor: rows.length > 50 ? rows[49].ordinal : null,
      differences: rows.slice(0, 50).map((row) => ({
        ordinal: row.ordinal,
        code: row.code as PaymentBillDifferenceSummary["code"],
        fields: row.fields,
        local: row.local as unknown as PaymentBillEntry | null,
        provider: row.provider as unknown as PaymentBillEntry | null,
      })),
    };
  }

  private summary(run: PaymentBillRun): PaymentBillRunSummary {
    return {
      id: run.id,
      billDate: run.billDate,
      requestedById: run.requestedById,
      status: run.status,
      fileSha256: run.fileSha256,
      rowCount: run.rowCount,
      localCount: run.localCount,
      differenceCount: run.differenceCount,
      snapshotAt: run.snapshotAt?.toISOString() ?? null,
      failureCode: run.failureCode,
      createdAt: run.createdAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    };
  }
}
