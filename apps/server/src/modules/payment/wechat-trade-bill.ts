import { ApiException } from "../../common/http/api-exception";

/** In-memory ALL bill limit; larger merchants require a streaming reconciliation importer. */
export const MAX_TRADE_BILL_BYTES = 16 * 1024 * 1024;
const MAX_ROWS = 20_000;
const HEADER =
  "交易时间,公众账号ID,商户号,特约商户号,设备号,微信订单号,商户订单号,用户标识,交易类型,交易状态,付款银行,货币种类,应结订单金额,代金券金额,微信退款单号,商户退款单号,退款金额,充值券退款金额,退款类型,退款状态,商品名称,商户数据包,手续费,费率,订单金额,申请退款金额,费率备注";
const SUMMARY =
  "总交易单数,应结订单总金额,退款总金额,充值券退款总金额,手续费总金额,订单总金额,申请退款总金额";
const MONEY_COLUMNS = [12, 16, 17, 22, 24, 25];
const invalid = () => new ApiException("PAYMENT_BILL_INVALID", "交易账单暂不可用或校验失败", 503);

/** Requires a real calendar date before today in the provider's China timezone. */
export function validateBillDate(value: string): void {
  const date =
    typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00Z`)
      : null;
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (
    !date ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value >= today
  ) {
    throw new ApiException("PAYMENT_BILL_DATE_INVALID", "请选择有效的历史账单日期", 400);
  }
}

function cents(value: string, signed = false): number {
  if (!(signed ? /^-?(?:0|[1-9]\d{0,12})\.\d{2}$/ : /^(?:0|[1-9]\d{0,12})\.\d{2}$/).test(value)) {
    throw invalid();
  }

  const result = Number(value.replace(".", ""));

  if (!Number.isSafeInteger(result)) {
    throw invalid();
  }

  return result;
}

function fields(line: string, count: number): string[] {
  const values = line.split(",");

  if (values.length !== count || values.some((value) => !value.startsWith("`"))) {
    throw invalid();
  }

  return values.map((value) => value.slice(1));
}

/** Strict current-format ALL parser. Legacy/unknown formats fail closed, never yield partial success. */
export function parseWechatTradeBill(bytes: Buffer, billDate: string, merchantId: string) {
  validateBillDate(billDate);

  if (bytes.length > MAX_TRADE_BILL_BYTES) {
    throw invalid();
  }

  let content: string;

  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw invalid();
  }

  const lines = content.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  const [summaryHeader, summaryLine] = lines.slice(-2);

  if (
    lines.length < 3 ||
    lines.length > MAX_ROWS + 3 ||
    lines[0] !== HEADER ||
    summaryHeader !== SUMMARY
  ) {
    throw invalid();
  }

  const totals = MONEY_COLUMNS.map(() => 0);
  const identities = new Set<string>();
  const providerIdentities = new Set<string>();
  const rows = lines.slice(1, -2).map((line) => {
    const values = fields(line, 27);
    const [
      time,
      appId,
      rowMerchantId,
      subMerchantId,
      ,
      transactionId,
      paymentId,
      ,
      tradeType,
      status,
    ] = values;
    const [
      settlementCents,
      refundSettlementCents,
      couponRefundCents,
      feeCents,
      amountCents,
      refundCents,
    ] = MONEY_COLUMNS.map((column) => cents(values[column], column === 22));
    const date = new Date(`${time.replace(" ", "T")}+08:00`);
    const isPayment = status === "SUCCESS";
    const identity = `${isPayment ? "payment" : "refund"}:${isPayment ? paymentId : values[15]}`;
    const providerIdentity = `${isPayment ? "payment" : "refund"}:${isPayment ? transactionId : values[14]}`;

    if (
      !/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time) ||
      time.slice(0, 10) !== billDate ||
      !Number.isFinite(date.getTime()) ||
      rowMerchantId !== merchantId ||
      !appId ||
      !transactionId ||
      !paymentId ||
      !tradeType ||
      !["SUCCESS", "REFUND", "REVOKED"].includes(status) ||
      values[11] !== "CNY" ||
      identities.has(identity) ||
      providerIdentities.has(providerIdentity) ||
      (isPayment
        ? amountCents <= 0 ||
          refundCents !== 0 ||
          refundSettlementCents !== 0 ||
          couponRefundCents !== 0 ||
          feeCents < 0 ||
          values[14] !== "0" ||
          values[15] !== "0" ||
          values[19] !== ""
        : refundCents <= 0 ||
          amountCents !== 0 ||
          settlementCents !== 0 ||
          feeCents > 0 ||
          !values[14] ||
          values[14] === "0" ||
          !values[15] ||
          values[15] === "0" ||
          !["SUCCESS", "PROCESSING", "FAIL", "CHANGE"].includes(values[19])) ||
      settlementCents > amountCents ||
      refundSettlementCents > refundCents ||
      couponRefundCents > refundSettlementCents ||
      cents(values[13]) > amountCents
    ) {
      throw invalid();
    }

    identities.add(identity);
    providerIdentities.add(providerIdentity);
    const amounts = [
      settlementCents,
      refundSettlementCents,
      couponRefundCents,
      feeCents,
      amountCents,
      refundCents,
    ];

    amounts.forEach((value, index) => {
      totals[index] += value;

      if (!Number.isSafeInteger(totals[index])) {
        throw invalid();
      }
    });

    // Historical refund bill time is acceptance time, not payout completion time.
    // Deliberately omit OpenID, product description and merchant attachment from parsed output.
    return {
      occurredAt: date.toISOString(),
      appId,
      merchantId: rowMerchantId,
      subMerchantId,
      transactionId,
      paymentId,
      tradeType,
      status,
      providerRefundId: isPayment ? null : values[14],
      refundId: isPayment ? null : values[15],
      refundStatus: isPayment ? null : values[19],
      settlementCents,
      refundSettlementCents,
      couponRefundCents,
      feeCents,
      amountCents,
      refundCents,
    };
  });
  const summary = fields(summaryLine, 7);

  if (
    !/^(?:0|[1-9]\d*)$/.test(summary[0]) ||
    Number(summary[0]) !== rows.length ||
    totals.some((value, index) => value !== cents(summary[index + 1], index === 3))
  ) {
    throw invalid();
  }

  return { billDate, rows, rowCount: rows.length };
}
