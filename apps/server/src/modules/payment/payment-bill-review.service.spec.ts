import { randomUUID } from "node:crypto";
import type { CreatePaymentBillReviewRequest } from "@petcare/shared-types";
import { normalizeBillReview } from "./payment-bill-review.service";

describe("bill review validation", () => {
  const command: CreatePaymentBillReviewRequest = {
    idempotencyKey: randomUUID(),
    expectedVersion: 0,
    action: "note",
    note: "Review the bill discrepancy",
  };

  it("canonicalizes retry keys, notes and evidence without inventing evidence", () => {
    expect(
      normalizeBillReview({
        ...command,
        idempotencyKey: command.idempotencyKey.toUpperCase(),
        note: "  Review the bill discrepancy  ",
      }),
    ).toEqual({ ...command, evidenceReference: null });
    expect(
      normalizeBillReview({
        ...command,
        action: "record_outcome",
        evidenceReference: "  CASE-2026/42  ",
      }).evidenceReference,
    ).toBe("CASE-2026/42");
  });

  it.each([
    { idempotencyKey: "invalid" },
    { expectedVersion: -1 },
    { expectedVersion: 0.5 },
    { expectedVersion: 2_147_483_647 },
    { action: "matched" },
    { note: "     " },
    { note: "x".repeat(1001) },
    { note: "Review\u0000secret" },
    { action: "record_outcome" },
    { action: "record_outcome", evidenceReference: "   " },
    { evidenceReference: "https://example.test/private?token=secret" },
    { evidenceReference: 12 },
    { evidenceReference: "x".repeat(201) },
  ])("rejects invalid or unsupported input %j", (patch) => {
    expect(() =>
      normalizeBillReview({ ...command, ...patch } as CreatePaymentBillReviewRequest),
    ).toThrow(expect.objectContaining({ code: "PAYMENT_BILL_REVIEW_INVALID" }));
  });
});
