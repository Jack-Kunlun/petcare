import { parseWechatTradeBill, validateBillDate } from "./wechat-trade-bill";

const header =
  "交易时间,公众账号ID,商户号,特约商户号,设备号,微信订单号,商户订单号,用户标识,交易类型,交易状态,付款银行,货币种类,应结订单金额,代金券金额,微信退款单号,商户退款单号,退款金额,充值券退款金额,退款类型,退款状态,商品名称,商户数据包,手续费,费率,订单金额,申请退款金额,费率备注";
const summaryHeader =
  "总交易单数,应结订单总金额,退款总金额,充值券退款总金额,手续费总金额,订单总金额,申请退款总金额";
const payment = [
  "2026-01-02 00:00:00",
  "wx1234567890abcdef",
  "1900000001",
  "0",
  "",
  "tx1",
  "pay1",
  "private-openid",
  "JSAPI",
  "SUCCESS",
  "OTHERS",
  "CNY",
  "12.00",
  "0.34",
  "0",
  "0",
  "0.00",
  "0.00",
  "",
  "",
  "private description\\ text",
  "private attachment",
  "0.07",
  "0.60%",
  "12.34",
  "0.00",
  "",
];
const refund = [...payment];

refund[0] = "2026-01-02 23:59:59";
refund[9] = "REFUND";
refund[12] = "0.00";
refund[13] = "0.00";
refund[14] = "provider-refund1";
refund[15] = "refund1";
refund[16] = "12.00";
refund[18] = "ORIGINAL";
refund[19] = "PROCESSING";
refund[22] = "-0.07";
refund[24] = "0.00";
refund[25] = "12.34";

function bill(
  rows = [payment, refund],
  summary = ["2", "12.00", "12.00", "0.00", "0.00", "12.34", "12.34"],
) {
  return Buffer.from(
    `${[
      header,
      ...rows.map((row) => row.map((v) => `\`${v}`).join(",")),
      summaryHeader,
      summary.map((v) => `\`${v}`).join(","),
    ].join("\r\n")}\r\n`,
  );
}

describe("WeChat ALL trade bill", () => {
  it("checks both sides of totals with integer cents and preserves historical refund acceptance", () => {
    const result = parseWechatTradeBill(bill(), "2026-01-02", "1900000001");

    expect(result.rowCount).toBe(2);
    expect(result.rows[0]).toMatchObject({
      amountCents: 1234,
      settlementCents: 1200,
      feeCents: 7,
      occurredAt: "2026-01-01T16:00:00.000Z",
      refundId: null,
    });
    expect(result.rows[1]).toMatchObject({
      amountCents: 0,
      refundCents: 1234,
      feeCents: -7,
      refundStatus: "PROCESSING",
      occurredAt: "2026-01-02T15:59:59.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(
      parseWechatTradeBill(
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bill()]),
        "2026-01-02",
        "1900000001",
      ),
    ).toEqual(result);
  });

  it("accepts only explicitly validated zero-row bills, never an empty file", () => {
    expect(
      parseWechatTradeBill(
        bill([], ["0", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"]),
        "2026-01-02",
        "1900000001",
      ).rowCount,
    ).toBe(0);
    expect(() => parseWechatTradeBill(Buffer.alloc(0), "2026-01-02", "1900000001")).toThrow();
  });

  it.each([
    [0, "2026-01-03 00:00:00"],
    [0, "2026-01-02 24:00:00"],
    [2, "1900000002"],
    [9, "UNKNOWN"],
    [11, "USD"],
    [12, "13.00"],
    [12, "1e2"],
    [12, "12.001"],
    [12, "-12.00"],
    [13, "13.00"],
    [14, "unexpected-refund"],
    [24, "0.00"],
    [24, "999999999999999.99"],
    [25, "1.00"],
  ])("rejects invalid row column %s value %s without partial data", (column, value) => {
    const altered = [...payment];

    altered[Number(column)] = String(value);
    expect(() =>
      parseWechatTradeBill(bill([altered, refund]), "2026-01-02", "1900000001"),
    ).toThrow();
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("rejects summary mismatch column %s", (index) => {
    const totals = ["2", "12.00", "12.00", "0.00", "0.00", "12.34", "12.34"];

    totals[index] = index === 0 ? "3" : "0.01";
    expect(() =>
      parseWechatTradeBill(bill([payment, refund], totals), "2026-01-02", "1900000001"),
    ).toThrow();
  });

  it("rejects duplicates, unknown layouts, missing summary, bad encoding and size limits", () => {
    const valid = bill();
    const invalid = [
      bill([payment, payment]),
      bill([refund, refund]),
      Buffer.from(valid.toString().replace("应结订单金额", "总金额")),
      Buffer.from(valid.toString().replace("`private-openid", "private-openid")),
      Buffer.from(valid.toString().replace(summaryHeader, "")),
      Buffer.from(`${valid.toString()}extra row`),
      Buffer.concat([valid, Buffer.from([0xff])]),
      Buffer.alloc(16 * 1024 * 1024 + 1),
      bill(Array.from({ length: 20_001 }, () => payment)),
    ];

    for (const bytes of invalid) {
      expect(() => parseWechatTradeBill(bytes, "2026-01-02", "1900000001")).toThrow();
    }
  });

  it("rejects repeated merchant or provider identities even when every total matches", () => {
    const otherPayment = [...payment];

    otherPayment[6] = "pay2";
    const otherRefund = [...refund];

    otherRefund[15] = "refund2";

    for (const duplicate of [payment, otherPayment]) {
      expect(() =>
        parseWechatTradeBill(
          bill([payment, duplicate], ["2", "24.00", "0.00", "0.00", "0.14", "24.68", "0.00"]),
          "2026-01-02",
          "1900000001",
        ),
      ).toThrow();
    }

    for (const duplicate of [refund, otherRefund]) {
      expect(() =>
        parseWechatTradeBill(
          bill([refund, duplicate], ["2", "0.00", "24.00", "0.00", "-0.14", "0.00", "24.68"]),
          "2026-01-02",
          "1900000001",
        ),
      ).toThrow();
    }
  });

  it("validates calendar dates and China timezone boundaries", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-12T16:00:00Z"));

    try {
      expect(() => validateBillDate("2026-09-12")).not.toThrow();

      for (const value of [
        "2026-09-13",
        "2026-02-30",
        "2026-09-14",
        "2026-1-02",
        "../secret",
        undefined,
        null,
      ]) {
        expect(() => validateBillDate(value as string)).toThrow();
      }

      expect(() => validateBillDate("2024-02-29")).not.toThrow();
    } finally {
      jest.useRealTimers();
    }
  });
});
