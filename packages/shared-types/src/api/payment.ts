/** 持久化支付状态；转入退款不代表退款已完成。 */
export type OrderPaymentStatus =
  /** 未确认收款，包含请求结果未知的情况。 */
  | "pending"
  /** 已验证微信收款成功。 */
  | "succeeded"
  /** 模拟流程已完成；没有发生收款，不可退款或结算。 */
  | "simulated"
  /** 微信已确认关闭未支付交易。 */
  | "closed"
  /** 微信交易已转入退款，尚未确认退款结果。 */
  | "refund_pending"
  /** 已验证全额退款成功，不可恢复履约。 */
  | "refunded";

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

/** 当前只支持已取消且未履约订单的一次全额原路退款。 */
export interface CreateOrderRefundRequest {
  /** 管理员操作原因，去除首尾空白后 5–500 字符。 */
  reason: string;
}

/** 退款受理不代表到账；异常和关闭状态必须保持履约冻结。 */
export type OrderRefundStatus =
  /** 本地已持久化，提供方是否受理尚不确定。 */
  | "pending"
  /** 微信已受理，等待最终结果。 */
  | "processing"
  /** 已验证退款成功。 */
  | "succeeded"
  /** 微信退款异常，需要商户处理后查单。 */
  | "abnormal"
  /** 微信已关闭退款，不代表重新允许履约。 */
  | "closed";

/** 不含付款账户或管理员原因的退款状态。 */
export interface OrderRefundSummary {
  /** 固定商户退款单号。 */
  refundId: string;
  /** 业务订单标识。 */
  orderId: string;
  /** 原支付单标识。 */
  paymentId: string;
  /** 冻结的整数分全额退款金额。 */
  amountCents: number;
  /** 验证后的退款状态。 */
  status: OrderRefundStatus;
  /** 微信确认的退款成功时间。 */
  succeededAt: string | null;
}

/** 自动状态核对发现的问题；不表示允许自动扣款、退款或改账。 */
export type PaymentReconciliationIssue =
  /** 连续至少三次查询失败，交易结果仍未知。 */
  | "query_failed"
  /** 已验签结果的业务字段不匹配，或原商户配置不一致。 */
  | "result_invalid"
  /** 支付单超过 24 小时仍未确认收款。 */
  | "payment_pending_too_long"
  /** 退款单超过 24 小时仍未确认退款成功。 */
  | "refund_pending_too_long"
  /** 微信退款异常，需要人工核查。 */
  | "refund_abnormal"
  /** 微信退款关闭，不可自动换号重退。 */
  | "refund_closed"
  /** 微信转入退款但本地没有退款单。 */
  | "external_refund"
  /** 已取消订单存在确认收款，尚未发起本地退款。 */
  | "cancelled_payment";

/** 管理员只读状态核对队列条目，不包含付款账户或密钥。 */
export interface PaymentReconciliationSummary {
  /** 本地固定支付单号。 */
  paymentId: string;
  /** 业务订单号。 */
  orderId: string;
  /** 原订单冻结金额，单位分。 */
  amountCents: number;
  /** 当前持久支付状态。 */
  paymentStatus: OrderPaymentStatus;
  /** 当前本地退款状态，没有退款单时为空。 */
  refundStatus: OrderRefundStatus | null;
  /** 待核查的问题分类。 */
  issue: PaymentReconciliationIssue;
  /** 连续自动查询失败次数，成功核对后归零。 */
  consecutiveFailures: number;
  /** 计划下一次查询的时间，不保证队列满载时准点执行。 */
  nextCheckAt: string;
  /** 最近成功核对支付结果的时间，不代表退款查询时间。 */
  paymentCheckedAt: string | null;
}

/** 显式发起日账核对；重试同一请求不得重复下载或覆盖旧结果。 */
export interface CreatePaymentBillRunRequest {
  /** 本次请求的 UUID；重新核对使用新 UUID。 */
  idempotencyKey: string;
  /** 微信中国时区账单日期 YYYY-MM-DD，只允许历史日期。 */
  billDate: string;
}

/** 核对执行状态；matched 仅表示指定快照与账单匹配，不表示结算完成。 */
export type PaymentBillRunStatus =
  /** 正在处理；进程中断也可能保留此状态，不可当成成功。 */
  | "running"
  /** 本次快照未发现差异。 */
  | "matched"
  /** 存在需核查的差异。 */
  | "differences"
  /** 下载、校验或持久化失败，没有成功核对结论。 */
  | "failed";

/** 只读日账执行摘要。 */
export interface PaymentBillRunSummary {
  /** 执行标识，也是原请求幂等键。 */
  id: string;
  /** 中国时区账单日期。 */
  billDate: string;
  /** 发起核对的管理员标识。 */
  requestedById: string;
  /** 本次执行状态。 */
  status: PaymentBillRunStatus;
  /** 已校验文件摘要；下载失败时为空。 */
  fileSha256: string | null;
  /** 账单明细数；未完成核对时为空。 */
  rowCount: number | null;
  /** 本次读取的本地支付单数，含关联退款。 */
  localCount: number | null;
  /** 差异总数，不受查询分页影响。 */
  differenceCount: number;
  /** 本地一致性快照时间。 */
  snapshotAt: string | null;
  /** 固定失败分类，不含提供方原始信息。 */
  failureCode: string | null;
  /** 请求持久化时间。 */
  createdAt: string;
  /** 执行结束时间；未知时为空。 */
  finishedAt: string | null;
}

/** 仅用于差异核查的最小交易快照，不包含付款人账户。 */
export interface PaymentBillEntry {
  /** 历史业务事件类型 SUCCESS 或 REFUND，不是当前退款处理状态。 */
  eventType: string;
  /** 原交易渠道；当前本地订单固定 JSAPI。 */
  tradeType: string;
  /** 子商户号；普通商户本地记录固定 0。 */
  subMerchantId: string;
  /** 冻结交易币种。 */
  currency: string;
  /** 商户支付单号。 */
  paymentId: string;
  /** 商户退款单号；支付行为空。 */
  refundId: string | null;
  /** 微信原支付交易号；本地未确认时为空。 */
  transactionId: string | null;
  /** 微信退款号；支付行或本地未确认时为空。 */
  providerRefundId: string | null;
  /** 该笔交易使用的 AppID。 */
  appId: string;
  /** 支付总额或申请退款额，整数分，不是折扣后的应结金额。 */
  amountCents: number;
  /** 支付成功或退款受理时刻；本地未知时为空。 */
  occurredAt: string | null;
}

/** 日账差异，只供人工核查，不能据此执行资金操作。 */
export interface PaymentBillDifferenceSummary {
  /** 执行内从 1 开始的顺序号，用于稳定分页。 */
  ordinal: number;
  /** 无本地记录、无账单记录、字段不匹配或退款日期未知。 */
  code:
    /** 账单有记录，本地无对应支付或退款单。 */
    | "local_missing"
    /** 本地已确认该日事件，账单无对应记录。 */
    | "provider_missing"
    /** 双方记录的标识、金额、时间或渠道不匹配。 */
    | "fields_mismatch"
    /** 退款受理时间未知，无法确定是否属于该日。 */
    | "refund_time_unknown";
  /** 不匹配字段名称；无记录类差异为空数组。 */
  fields: string[];
  /** 核对时本地记录的最小快照。 */
  local: PaymentBillEntry | null;
  /** 该账单行的最小快照。 */
  provider: PaymentBillEntry | null;
}

/** 每页最多 50 项差异。 */
export interface PaymentBillRunDetail {
  /** 包含全量计数的执行摘要。 */
  run: PaymentBillRunSummary;
  /** 当前页差异。 */
  differences: PaymentBillDifferenceSummary[];
  /** 下一页 after 参数；最后一页为空。 */
  nextCursor: number | null;
}

/** 人工处理动作，不执行查单、退款、改账或重写核对结论。 */
export type PaymentBillReviewAction =
  /** 追加说明，不改变人工处理状态。 */
  | "note"
  /** 记录有依据的处理结论，不代表差异消失或资金匹配。 */
  | "record_outcome"
  /** 将已记录结论的差异重新转为待处理。 */
  | "reopen";

/** 人工处理状态，与日账运行状态严格分离。 */
export type PaymentBillReviewStatus =
  /** 尚待处理，或已重新打开。 */
  | "open"
  /** 已记录人工处理结论，原差异仍永久保留。 */
  | "documented";

/** 为一项日账差异追加不可覆盖的处理记录。 */
export interface CreatePaymentBillReviewRequest {
  /** 本次操作 UUID v4；网络重试复用，新的操作使用新值。 */
  idempotencyKey: string;
  /** 最近读取的处理版本；无历史时为 0，冲突时必须重新读取。 */
  expectedVersion: number;
  /** 本次处理动作。 */
  action: PaymentBillReviewAction;
  /** 去除首尾空白后 5–1000 字符，不应包含个人资料、凭据或原始账单。 */
  note: string;
  /** 可审计工单或文档编号，3–200 位字母、数字及 . _ / -；记录结论时必填，不接受 URL 或密钥。 */
  evidenceReference?: string | null;
}

/** 一条只追加的人工处理审计记录。 */
export interface PaymentBillReviewEntry {
  /** 操作标识，也是幂等键。 */
  id: string;
  /** 所属日账运行标识。 */
  runId: string;
  /** 差异顺序号。 */
  ordinal: number;
  /** 该差异内从 1 开始递增的处理版本。 */
  version: number;
  /** 操作人账号标识。 */
  actorId: string;
  /** 操作类型。 */
  action: PaymentBillReviewAction;
  /** 本次操作后的人工处理状态，不是财务核对结论。 */
  status: PaymentBillReviewStatus;
  /** 操作说明。 */
  note: string;
  /** 支撑处理结论的工单或文档编号。 */
  evidenceReference: string | null;
  /** 数据库记录的操作时间。 */
  createdAt: string;
}

/** 按版本正序读取的处理历史，每页最多 50 条。 */
export interface PaymentBillReviewHistory {
  /** 当前可见的最新版本，无记录为 0。 */
  version: number;
  /** 当前人工处理状态。 */
  status: PaymentBillReviewStatus;
  /** 当前页只追加历史。 */
  entries: PaymentBillReviewEntry[];
  /** 下一页 after 参数，末页为空。 */
  nextCursor: number | null;
}

/** 支付巡检列表的游标；日账使用 UUID，状态队列使用固定支付单号。 */
export interface PaymentOperationsPageQuery {
  /** 上一页返回的 nextCursor，首次查询不传。 */
  after?: string;
}

/** 当前商户的日账运行历史，按创建时间倒序，每页最多 20 条。 */
export interface PaymentBillRunPage {
  /** 本页运行记录，包含失败及未结束记录。 */
  list: PaymentBillRunSummary[];
  /** 下一页游标；为空表示本次查询已到末页。 */
  nextCursor: string | null;
}

/** 当前商户状态核对异常，按固定支付单号排序，每页最多 50 条。 */
export interface PaymentReconciliationPage {
  /** 本页当前异常；队列会随真实查单结果变化。 */
  list: PaymentReconciliationSummary[];
  /** 下一页游标；为空表示本次查询已到末页。 */
  nextCursor: string | null;
}
