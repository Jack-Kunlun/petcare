import { comparePaymentBill } from "./payment-bill.service";

type Payment = Parameters<typeof comparePaymentBill>[1][number];
type Bill = Parameters<typeof comparePaymentBill>[0];
const at = new Date("2026-01-01T16:00:00.123Z");

function payment(): Payment {
  return {
    id: "pay1",
    appId: "wx1",
    merchantId: "merchant1",
    currency: "CNY",
    transactionId: "tx1",
    amountCents: 1234,
    paidAt: at,
    status: "refunded",
    refund: {
      id: "refund1",
      providerRefundId: "rf1",
      amountCents: 1234,
      acceptedAt: at,
      createdAt: at,
      succeededAt: new Date("2026-01-04T00:00:00Z"),
      status: "succeeded",
    },
  } as Payment;
}

function bill(): Bill {
  const row = {
    occurredAt: "2026-01-01T16:00:00.000Z",
    appId: "wx1",
    merchantId: "merchant1",
    subMerchantId: "0",
    transactionId: "tx1",
    paymentId: "pay1",
    tradeType: "JSAPI",
    status: "SUCCESS",
    providerRefundId: null,
    refundId: null,
    refundStatus: null,
    settlementCents: 1200,
    refundSettlementCents: 0,
    couponRefundCents: 0,
    feeCents: 7,
    amountCents: 1234,
    refundCents: 0,
  };

  return {
    billDate: "2026-01-02",
    rowCount: 2,
    sha256: "a".repeat(64),
    rows: [
      row,
      {
        ...row,
        status: "REFUND",
        providerRefundId: "rf1",
        refundId: "refund1",
        refundStatus: "PROCESSING",
        amountCents: 0,
        refundCents: 1234,
        feeCents: -7,
      },
    ],
  };
}

describe("daily bill comparison", () => {
  it("matches full amounts and historical times without comparing current refund status or millisecond precision", () => {
    expect(comparePaymentBill(bill(), [payment()])).toEqual([]);
  });

  it("finds missing entries in both directions and retains minimal snapshots", () => {
    const source = bill();

    expect(comparePaymentBill(source, []).map((entry) => entry.code)).toEqual([
      "local_missing",
      "local_missing",
    ]);
    const missing = comparePaymentBill({ ...source, rows: [] }, [payment()]);

    expect(missing.map((entry) => entry.code)).toEqual(["provider_missing", "provider_missing"]);
    expect(missing[1].local).toMatchObject({ refundId: "refund1", amountCents: 1234 });
  });

  it.each([
    ["amountCents", 100],
    ["transactionId", "other"],
    ["appId", "other"],
    ["occurredAt", "2026-01-02T00:00:00Z"],
    ["subMerchantId", "submerchant"],
    ["tradeType", "NATIVE"],
  ])("reports mismatched %s", (key, value) => {
    const source = bill();

    Object.assign(source.rows[0], { [key]: value });
    expect(comparePaymentBill(source, [payment()])[0]).toMatchObject({
      code: "fields_mismatch",
      fields: [key],
    });
  });

  it("matches refund number independently to detect an incorrect original payment link", () => {
    const source = bill();

    source.rows[1].paymentId = "wrong-payment";
    expect(comparePaymentBill(source, [payment()])[0]).toMatchObject({
      code: "fields_mismatch",
      fields: ["paymentId"],
      local: { paymentId: "pay1" },
      provider: { paymentId: "wrong-payment" },
    });
  });

  it("does not infer refund dates or use payout time to exclude unknown coverage", () => {
    const local = payment();

    local.refund!.acceptedAt = null;
    expect(comparePaymentBill(bill(), [local]).map((entry) => entry.code)).toEqual([
      "fields_mismatch",
      "refund_time_unknown",
    ]);
    const source = bill();

    source.rows = [source.rows[0]];
    expect(comparePaymentBill(source, [local])[0].code).toBe("refund_time_unknown");
  });

  it("excludes next-day local records from reverse checks and includes the first second of the day", () => {
    const local = payment();
    const source = { ...bill(), rows: [] };

    expect(comparePaymentBill(source, [local])).toHaveLength(2);
    local.paidAt = new Date("2026-01-02T16:00:00Z");
    local.refund!.acceptedAt = local.paidAt;
    expect(comparePaymentBill(source, [local])).toEqual([]);
  });
});
