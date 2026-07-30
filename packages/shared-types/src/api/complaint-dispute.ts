import type { PaginatedResponse } from "./response";

/** 投诉纠纷的当前处理阶段。 */
export const COMPLAINT_STATUS = {
  /** 等待被投诉方首次回应。 */
  PENDING_RESPONSE: "pending_response",
  /** 等待管理员认领。 */
  UNASSIGNED: "unassigned",
  /** 正在进行初审裁决。 */
  PROCESSING_INITIAL: "processing_initial",
  /** 初审已裁决，等待二次申诉窗口结束或申诉。 */
  INITIAL_DECIDED: "initial_decided",
  /** 正在进行终审裁决。 */
  PROCESSING_FINAL: "processing_final",
  /** 裁决执行完成并关闭。 */
  CLOSED: "closed",
  /** 投诉方已撤回投诉。 */
  WITHDRAWN: "withdrawn",
} as const;

/** 投诉纠纷的当前处理阶段。 */
export type ComplaintStatus = (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

/** 由服务端根据当前状态和操作人计算的可执行动作。 */
export const COMPLAINT_ACTION = {
  /** 提交被投诉方的首次陈述。 */
  RESPOND: "respond",
  /** 投诉方在初审前撤回投诉。 */
  WITHDRAW: "withdraw",
  /** 在初审后提交二次申诉。 */
  SECOND_APPEAL: "second_appeal",
  /** 管理员认领待处理投诉。 */
  CLAIM: "claim",
  /** 管理员转交投诉处理人。 */
  TRANSFER: "transfer",
  /** 管理员提交初审裁决。 */
  INITIAL_DECIDE: "initial_decide",
  /** 管理员提交终审裁决。 */
  FINAL_DECIDE: "final_decide",
  /** 管理员重试失败的裁决执行任务。 */
  RETRY_EXECUTION: "retry_execution",
} as const;

/** 由服务端控制的投诉纠纷动作。 */
export type ComplaintAction = (typeof COMPLAINT_ACTION)[keyof typeof COMPLAINT_ACTION];

/** 裁决层级。 */
export const DECISION_LEVEL = {
  /** 首次裁决。 */
  INITIAL: "initial",
  /** 二次申诉后的最终裁决。 */
  FINAL: "final",
} as const;

/** 裁决层级。 */
export type DecisionLevel = (typeof DECISION_LEVEL)[keyof typeof DECISION_LEVEL];

/** 创建投诉的请求参数。 */
export interface CreateComplaintRequest {
  /** 被投诉订单的唯一标识。 */
  orderId: string;
  /** 投诉业务类型。 */
  complaintType: string;
  /** 投诉原因说明。 */
  reason: string;
  /** 投诉方提交的证据材料地址。 */
  evidenceUrls: string[];
  /** 投诉方期望的处理方案。 */
  expectedSolution: string;
}

/** 提交投诉方或被投诉方陈述的请求参数。 */
export interface SubmitComplaintStatementRequest {
  /** 陈述内容。 */
  statement: string;
  /** 陈述附带的证据材料地址。 */
  evidenceUrls: string[];
  /** 客户端读取详情时获得的并发版本。 */
  version: number;
}

/** 管理员认领投诉的请求参数。 */
export interface ClaimComplaintRequest {
  /** 客户端读取详情时获得的并发版本。 */
  version: number;
}

/** 管理员转交投诉的请求参数。 */
export interface TransferComplaintRequest {
  /** 接收案件的目标管理员唯一标识。 */
  targetAdminId: string;
  /** 本次转交案件的原因。 */
  reason: string;
  /** 客户端读取详情时获得的并发版本。 */
  version: number;
}

/** 投诉陈述的客户端视图。 */
export interface ComplaintStatementView {
  /** 陈述记录唯一标识。 */
  id: string;
  /** 陈述阶段。 */
  stage: string;
  /** 陈述提交人唯一标识。 */
  authorId: string;
  /** 陈述正文。 */
  statement: string;
  /** 陈述附带的证据材料地址。 */
  evidenceUrls: string[];
  /** ISO 8601 格式的提交时间。 */
  createdAt: string;
}

/** 投诉状态事件的客户端视图。 */
export interface ComplaintEventView {
  /** 事件唯一标识。 */
  id: string;
  /** 操作人唯一标识；系统事件时为 null。 */
  actorId: string | null;
  /** 触发事件的业务动作。 */
  action: string;
  /** 动作发生前的投诉状态；创建事件时为 null。 */
  fromStatus: ComplaintStatus | null;
  /** 动作完成后的投诉状态；无状态变更时为 null。 */
  toStatus: ComplaintStatus | null;
  /** JSON 格式的事件扩展数据；无扩展数据时为 null。 */
  payload: string | null;
  /** ISO 8601 格式的事件发生时间。 */
  createdAt: string;
}

/** 后台投诉列表的筛选条件。 */
export interface AdminComplaintListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数。 */
  pageSize: number;
  /** 可选的投诉状态筛选。 */
  status?: ComplaintStatus;
  /** 可选的订单号或用户关键字筛选。 */
  keyword?: string;
  /** 可选的处理管理员标识筛选。 */
  handlerId?: string;
}

/** 后台投诉列表中的单条投诉摘要。 */
export interface AdminComplaintListItem {
  /** 投诉唯一标识。 */
  id: string;
  /** 被投诉订单的唯一标识。 */
  orderId: string;
  /** 投诉方用户唯一标识。 */
  complainantId: string;
  /** 被投诉方用户唯一标识。 */
  respondentId: string;
  /** 当前投诉处理状态。 */
  status: ComplaintStatus;
  /** 当前处理管理员标识；未认领时为 null。 */
  handlerId: string | null;
  /** ISO 8601 格式的投诉创建时间。 */
  createdAt: string;
  /** ISO 8601 格式的最后更新时间。 */
  updatedAt: string;
}

/** 后台投诉列表的分页响应。 */
export type AdminComplaintListResponse = PaginatedResponse<AdminComplaintListItem>;

/** 投诉纠纷详情。 */
export interface ComplaintDetail {
  /** 投诉唯一标识。 */
  id: string;
  /** 被投诉订单的唯一标识。 */
  orderId: string;
  /** 投诉方用户唯一标识。 */
  complainantId: string;
  /** 被投诉方用户唯一标识。 */
  respondentId: string;
  /** 投诉业务类型。 */
  complaintType: string;
  /** 投诉方期望的处理方案。 */
  expectedSolution: string | null;
  /** 当前投诉处理状态。 */
  status: ComplaintStatus;
  /** 投诉原因说明。 */
  reason: string;
  /** 投诉方提交的证据材料地址。 */
  evidenceUrls: string[];
  /** 被投诉方的首次陈述；尚未提交时为 null。 */
  respondentStatement: string | null;
  /** 被投诉方提交的证据材料地址。 */
  respondentEvidenceUrls: string[];
  /** 当前处理管理员标识；未认领时为 null。 */
  handlerId: string | null;
  /** 初审裁决；尚未初审时为 null。 */
  initialDecision: SubmitDisputeDecisionRequest | null;
  /** 终审裁决；尚未终审时为 null。 */
  finalDecision: SubmitDisputeDecisionRequest | null;
  /** 各阶段按提交时间排列的陈述材料。 */
  statements: ComplaintStatementView[];
  /** 按发生时间排列的状态事件。 */
  events: ComplaintEventView[];
  /** ISO 8601 格式的二次申诉截止时间；不适用时为 null。 */
  secondAppealDeadline: string | null;
  /** 服务端为当前访问者计算的允许动作。 */
  allowedActions: ComplaintAction[];
  /** 客户端读取详情时获得的并发版本。 */
  version: number;
  /** ISO 8601 格式的投诉创建时间。 */
  createdAt: string;
  /** ISO 8601 格式的最后更新时间。 */
  updatedAt: string;
}

/** 提交投诉纠纷裁决的请求参数。 */
export interface SubmitDisputeDecisionRequest {
  /** 责任划分。 */
  liability: "complainant" | "respondent" | "shared" | "insufficient_evidence";
  /** 裁决理由，去除首尾空白后长度为 10–1000。 */
  reason: string;
  /** 退还投诉方的金额，单位为分。 */
  refundAmount: number;
  /** 结算给服务方的金额，单位为分。 */
  settlementAmount: number;
  /** 投诉方信用分调整，范围为 -100 至 100。 */
  complainantCreditDelta: number;
  /** 被投诉方信用分调整，范围为 -100 至 100。 */
  respondentCreditDelta: number;
  /** 客户端读取详情时获得的并发版本。 */
  version: number;
}

/** 裁决执行任务的客户端视图。 */
export interface DisputeExecutionTaskView {
  /** 执行任务唯一标识。 */
  id: string;
  /** 关联投诉的唯一标识。 */
  complaintId: string;
  /** 对应裁决层级。 */
  decisionLevel: DecisionLevel;
  /** 执行状态。 */
  status: "pending" | "processing" | "succeeded" | "failed";
  /** 失败原因；未失败时为 null。 */
  failureReason: string | null;
  /** 已执行的重试次数。 */
  retryCount: number;
  /** ISO 8601 格式的创建时间。 */
  createdAt: string;
  /** ISO 8601 格式的最后更新时间。 */
  updatedAt: string;
}
