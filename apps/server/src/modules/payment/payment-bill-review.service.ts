import { Injectable } from "@nestjs/common";
import type {
  CreatePaymentBillReviewRequest,
  PaymentBillReviewEntry,
  PaymentBillReviewHistory,
  PaymentBillReviewStatus,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { Prisma, type PaymentBillReview } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = () => new ApiException("PAYMENT_BILL_REVIEW_INVALID", "差异处理参数无效", 400);
const conflict = () =>
  new ApiException(
    "PAYMENT_BILL_REVIEW_CONFLICT",
    "处理记录已变化或请求标识已使用，请重新读取",
    409,
  );
const missing = () => new ApiException("PAYMENT_BILL_NOT_FOUND", "日账差异不存在", 404);
const unavailable = () =>
  new ApiException(
    "PAYMENT_BILL_REVIEW_UNAVAILABLE",
    "差异处理暂不可用，请使用原请求标识重试",
    503,
  );

function integer(value: number, min: number, max = 2_147_483_647): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

/** Normalize before persisting or comparing an idempotent request; evidence is a reference, never a URL. */
export function normalizeBillReview(input: CreatePaymentBillReviewRequest) {
  if (
    input.evidenceReference !== null &&
    input.evidenceReference !== undefined &&
    typeof input.evidenceReference !== "string"
  ) {
    throw invalid();
  }

  const note = typeof input.note === "string" ? input.note.trim() : "";
  const evidenceReference = input.evidenceReference?.trim() || null;

  if (
    typeof input.idempotencyKey !== "string" ||
    !uuid.test(input.idempotencyKey) ||
    !integer(input.expectedVersion, 0, 2_147_483_646) ||
    !["note", "record_outcome", "reopen"].includes(input.action) ||
    note.length < 5 ||
    note.length > 1000 ||
    // Reject non-printing controls while preserving ordinary multi-line notes.
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(note) ||
    (evidenceReference !== null &&
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,199}$/.test(evidenceReference)) ||
    (input.action === "record_outcome" && !evidenceReference)
  ) {
    throw invalid();
  }

  return { ...input, idempotencyKey: input.idempotencyKey.toLowerCase(), note, evidenceReference };
}

function summary(row: PaymentBillReview): PaymentBillReviewEntry {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/** Append-only administrative history. No payment, refund, bill snapshot or reconciliation result writes. */
@Injectable()
export class PaymentBillReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private target(runId: string, ordinal: number): string {
    if (!uuid.test(runId) || !integer(ordinal, 1)) {
      throw invalid();
    }

    const merchantId = this.config.wechatPay?.merchantId;

    if (!merchantId) {
      throw missing();
    }

    return merchantId;
  }

  /** Lock one difference, reject stale versions, and atomically append its next audit event. */
  async append(
    actorId: string,
    runId: string,
    ordinal: number,
    input: CreatePaymentBillReviewRequest,
  ): Promise<PaymentBillReviewEntry> {
    const merchantId = this.target(runId, ordinal);

    runId = runId.toLowerCase();
    const command = normalizeBillReview(input);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const targets = await tx.$queryRaw<Array<{ run_id: string }>>`
          SELECT d."run_id" FROM "payment_bill_differences" d
          JOIN "payment_bill_runs" r ON r."id" = d."run_id"
          WHERE d."run_id" = ${runId} AND d."ordinal" = ${ordinal}
            AND r."merchant_id" = ${merchantId} AND r."status" = 'differences'
          FOR UPDATE OF d`;

        if (targets.length === 0) {
          throw missing();
        }

        const existing = await tx.paymentBillReview.findUnique({
          where: { id: command.idempotencyKey },
        });

        if (existing) {
          if (
            existing.runId !== runId ||
            existing.ordinal !== ordinal ||
            existing.actorId !== actorId ||
            existing.version !== command.expectedVersion + 1 ||
            existing.action !== command.action ||
            existing.note !== command.note ||
            existing.evidenceReference !== command.evidenceReference
          ) {
            throw conflict();
          }

          return summary(existing);
        }

        const latest = await tx.paymentBillReview.findFirst({
          where: { runId, ordinal },
          orderBy: { version: "desc" },
        });

        if ((latest?.version ?? 0) !== command.expectedVersion) {
          throw conflict();
        }

        let status: PaymentBillReviewStatus = latest?.status ?? "open";

        if (command.action === "record_outcome") {
          if (status !== "open") {
            throw conflict();
          }

          status = "documented";
        } else if (command.action === "reopen") {
          if (status !== "documented") {
            throw conflict();
          }

          status = "open";
        }

        return summary(
          await tx.paymentBillReview.create({
            data: {
              id: command.idempotencyKey,
              runId,
              ordinal,
              actorId,
              version: command.expectedVersion + 1,
              action: command.action,
              status,
              note: command.note,
              evidenceReference: command.evidenceReference,
            },
          }),
        );
      });
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw conflict();
      }

      // Database errors may contain the submitted note; expose and log only a fixed classification.
      throw unavailable();
    }
  }

  /** Snapshot-consistent version and stable cursor history; deleted or foreign-merchant targets are not visible. */
  async history(runId: string, ordinal: number, after: number): Promise<PaymentBillReviewHistory> {
    const merchantId = this.target(runId, ordinal);

    runId = runId.toLowerCase();

    if (!integer(after, 0)) {
      throw invalid();
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const difference = await tx.paymentBillDifference.findFirst({
            where: {
              runId,
              ordinal,
              run: { merchantId, status: "differences" },
            },
            select: { ordinal: true },
          });

          if (!difference) {
            throw missing();
          }

          const latest = await tx.paymentBillReview.findFirst({
            where: { runId, ordinal },
            orderBy: { version: "desc" },
          });
          const rows = await tx.paymentBillReview.findMany({
            where: { runId, ordinal, version: { gt: after } },
            orderBy: { version: "asc" },
            take: 51,
          });

          return {
            version: latest?.version ?? 0,
            status: latest?.status ?? "open",
            entries: rows.slice(0, 50).map(summary),
            nextCursor: rows.length > 50 ? rows[49].version : null,
          };
        },
        { isolationLevel: "RepeatableRead" },
      );
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw unavailable();
    }
  }
}
