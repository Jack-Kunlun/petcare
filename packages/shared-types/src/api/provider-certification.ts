import type { PaginatedResponse } from "./response";

/** 宠托师认证申请状态的可选值。 */
export const PROVIDER_CERTIFICATION_STATUS = {
  /** 等待管理员审核。 */
  PENDING: "pending",
  /** 审核通过并授予宠托师认证。 */
  APPROVED: "approved",
  /** 审核驳回，允许用户重新申请。 */
  REJECTED: "rejected",
} as const;

/** 宠托师认证申请状态。 */
export type ProviderCertificationStatus =
  (typeof PROVIDER_CERTIFICATION_STATUS)[keyof typeof PROVIDER_CERTIFICATION_STATUS];

/** 认证申请人的后台安全摘要。 */
export interface ProviderCertificationApplicantSummary {
  /** 用户唯一标识。 */
  id: string;
  /** 用户手机号。 */
  phone: string;
  /** 用户登录账号；未设置时为 null。 */
  username: string | null;
  /** 用户展示昵称。 */
  nickname: string;
  /** 用户头像地址；未设置时为 null。 */
  avatar: string | null;
}

/** 审核管理员摘要。 */
export interface ProviderCertificationReviewerSummary {
  /** 管理员唯一标识。 */
  id: string;
  /** 管理员展示昵称。 */
  nickname: string;
}

/** 后台认证申请分页查询参数。 */
export interface AdminProviderCertificationListQuery {
  /** 页码，从 1 开始。 */
  page: number;
  /** 每页条数，范围为 1 至 100。 */
  pageSize: number;
  /** 匹配手机号、账号或昵称的可选关键词。 */
  keyword?: string;
  /** 可选的申请状态筛选。 */
  status?: ProviderCertificationStatus;
}

/** 后台认证申请列表项。 */
export interface AdminProviderCertificationListItem {
  /** 认证申请唯一标识。 */
  id: string;
  /** 申请人摘要。 */
  applicant: ProviderCertificationApplicantSummary;
  /** 脱敏后的真实姓名。 */
  realNameMasked: string;
  /** 是否已提交脱敏身份证资料。 */
  idCardVerified: boolean;
  /** 是否已通过平台培训。 */
  trainingPassed: boolean;
  /** 微信支付分；未提供时为 null。 */
  wechatScore: number | null;
  /** 当前审核状态。 */
  status: ProviderCertificationStatus;
  /** ISO 8601 格式的申请时间。 */
  createdAt: string;
  /** ISO 8601 格式的审核时间；尚未审核时为 null。 */
  reviewedAt: string | null;
}

/** 后台认证申请分页响应。 */
export type AdminProviderCertificationListResponse =
  PaginatedResponse<AdminProviderCertificationListItem>;

/** 后台认证申请详情。 */
export interface AdminProviderCertificationDetail extends AdminProviderCertificationListItem {
  /** 脱敏后的身份证号码。 */
  idCardMasked: string;
  /** 身份证正面证明材料地址。 */
  idCardFrontUrl: string;
  /** 身份证背面证明材料地址。 */
  idCardBackUrl: string;
  /** 驳回原因；非驳回状态时为 null。 */
  rejectReason: string | null;
  /** 审核管理员；尚未审核时为 null。 */
  reviewedBy: ProviderCertificationReviewerSummary | null;
  /** ISO 8601 格式的最后更新时间。 */
  updatedAt: string;
}

/** 驳回宠托师认证申请的请求。 */
export interface RejectProviderCertificationRequest {
  /** 驳回原因，去除首尾空白后长度为 2–500 个字符。 */
  reason: string;
}
