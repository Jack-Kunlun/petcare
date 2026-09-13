/** 持久化支付状态；转入退款不代表退款已完成。 */
export type OrderPaymentStatus =
  /** 未确认收款，包含请求结果未知的情况。 */
  | "pending"
  /** 已验证微信收款成功。 */
  | "succeeded"
  /** 微信已确认关闭未支付交易。 */
  | "closed"
  /** 微信交易已转入退款，尚未确认退款结果。 */
  | "refund_pending";

/** 仅订单主人可读的支付状态，不含商户凭据或 OpenID。 */
export interface OrderPaymentSummary {
  /** 业务订单标识。 */
  orderId: string;
  /** 固定商户支付单号。 */
  paymentId: string;
  /** 服务端冻结的整数分金额。 */
  amountCents: number;
  /** 验证后的支付状态。 */
  status: OrderPaymentStatus;
  /** 微信确认的支付时间；未确认时为空。 */
  paidAt: string | null;
}

/** 只用于小程序调起支付，不可视为收款成功证明。 */
export interface WechatPaymentParameters {
  /** 调起签名的秒级时间戳。 */
  timeStamp: string;
  /** 随机字符串。 */
  nonceStr: string;
  /** 微信预支付凭证。 */
  package: string;
  /** 固定 RSA 签名算法。 */
  signType: "RSA";
  /** 商户私钥对调起参数的签名。 */
  paySign: string;
}

/** 持久支付单与本次调起参数。 */
export interface OrderPrepayResponse {
  /** 服务端支付单快照，不表示客户端已完成支付。 */
  payment: OrderPaymentSummary;
  /** 本次微信调起参数。 */
  parameters: WechatPaymentParameters;
}
