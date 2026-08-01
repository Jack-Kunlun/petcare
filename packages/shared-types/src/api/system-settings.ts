/** 系统配置支持的业务领域。 */
export const SYSTEM_CONFIG_DOMAIN = {
  /** 服务标准作业流程与违规规则。 */
  SOP: "sop",
  /** 服务者评分阈值与再培训要求。 */
  RATING_THRESHOLD: "rating_threshold",
  /** 平台服务费与提现费率。 */
  FEE: "fee",
} as const;

/** 系统配置支持的业务领域。 */
export type SystemConfigDomain = (typeof SYSTEM_CONFIG_DOMAIN)[keyof typeof SYSTEM_CONFIG_DOMAIN];

/** 系统配置版本的发布状态。 */
export const SYSTEM_CONFIG_STATUS = {
  /** 尚未发布、可继续编辑的草稿。 */
  DRAFT: "draft",
  /** 当前或曾经生效的已发布版本。 */
  PUBLISHED: "published",
  /** 已被后续版本替代的历史版本。 */
  SUPERSEDED: "superseded",
} as const;

/** 系统配置版本的发布状态。 */
export type SystemConfigStatus = (typeof SYSTEM_CONFIG_STATUS)[keyof typeof SYSTEM_CONFIG_STATUS];

/** 系统配置接口返回的稳定错误码。 */
export const SYSTEM_CONFIG_ERROR_CODE = {
  /** 保存、发布或恢复时提交的乐观锁版本已过期。 */
  VERSION_CONFLICT: "SYSTEM_CONFIG_VERSION_CONFLICT",
} as const;

/** 系统配置接口返回的稳定错误码。 */
export type SystemConfigErrorCode =
  (typeof SYSTEM_CONFIG_ERROR_CODE)[keyof typeof SYSTEM_CONFIG_ERROR_CODE];

/** 服务标准作业流程配置。 */
export interface SopConfig {
  /** 接单后的确认与预约沟通要求。 */
  orderConfirmation: string;
  /** 服务开始前的准备、核验与沟通要求。 */
  beforeService: string;
  /** 服务进行中的操作与安全要求。 */
  serviceExecution: string;
  /** 服务完成后的交付与确认要求。 */
  serviceCompletion: string;
  /** 服务结束后的评价与反馈要求。 */
  serviceEvaluation: string;
  /** 违反服务标准时适用的规则说明。 */
  violationRules: string[];
}

/** 服务者评分阈值配置。 */
export interface RatingThresholdConfig {
  /** 用于计算评分的时间窗口，单位为天。 */
  evaluationWindow: number;
  /** 评分生效所需的最小评价样本数。 */
  minimumSampleSize: number;
  /** 触发预警的评分阈值，使用整数百分值。 */
  warningScore: number;
  /** 触发暂停接单的评分阈值，使用整数百分值。 */
  suspensionScore: number;
  /** 触发暂停后恢复服务前必须完成的再培训要求。 */
  retrainingRequirement: string;
}

/** 平台费用配置。 */
export interface FeeConfig {
  /** 平台从订单中收取的佣金比例，使用整数万分比。 */
  platformCommissionBps: number;
  /** 悬赏订单收取的服务费，单位为分。 */
  rewardServiceFeeCents: number;
  /** 提现手续费比例，使用整数万分比。 */
  withdrawalFeeBps: number;
  /** 提现时收取的最低手续费，单位为分。 */
  minimumWithdrawalFeeCents: number;
}

/** 已发布系统配置版本的历史记录。 */
export interface SystemConfigVersion<TConfig> {
  /** 配置版本记录的唯一标识。 */
  id: string;
  /** 配置所属业务领域。 */
  domain: SystemConfigDomain;
  /** 该领域内单调递增的已发布版本号。 */
  version: number;
  /** 该已发布版本当前的生命周期状态。 */
  status: SystemConfigStatus;
  /** 该版本冻结的强类型配置内容。 */
  config: TConfig;
  /** 本版本变更的业务摘要。 */
  changeSummary: string;
  /** 发布该版本的管理员唯一标识。 */
  publishedBy: string;
  /** ISO 8601 格式的发布时间。 */
  publishedAt: string;
}

/** 可编辑系统配置草稿的当前视图。 */
export interface SystemConfigDraft<TConfig> {
  /** 配置草稿的唯一标识。 */
  id: string;
  /** 草稿所属业务领域。 */
  domain: SystemConfigDomain;
  /** 用于乐观锁控制的当前修订号。 */
  revision: number;
  /** 当前待发布的强类型配置内容。 */
  config: TConfig;
  /** 最近一次保存时填写的变更摘要。 */
  changeSummary: string;
  /** 最后保存该草稿的管理员唯一标识。 */
  updatedBy: string;
  /** ISO 8601 格式的草稿最后更新时间。 */
  updatedAt: string;
}

/** 两个配置版本之间的单字段差异。 */
export interface SystemConfigDiff {
  /** 发生变化的配置字段路径。 */
  field: string;
  /** 变更前的字段值。 */
  previousValue: unknown;
  /** 变更后的字段值。 */
  nextValue: unknown;
}

/** 保存系统配置草稿的请求参数。 */
export interface SaveSystemConfigDraftRequest<TConfig> {
  /** 客户端最后读取到的乐观锁版本。 */
  revision: number;
  /** 待保存的强类型领域配置。 */
  config: TConfig;
  /** 本次修改的业务摘要。 */
  changeSummary: string;
}

/** 发布系统配置草稿的请求参数。 */
export interface PublishSystemConfigRequest {
  /** 待发布草稿的乐观锁版本。 */
  revision: number;
  /** 防止重复发布的唯一请求键。 */
  idempotencyKey: string;
}

/** 将已发布历史版本恢复为新草稿的请求参数。 */
export interface RestoreSystemConfigRequest {
  /** 要恢复的已发布历史版本号。 */
  version: number;
  /** 当前草稿的乐观锁版本。 */
  revision: number;
  /** 本次恢复操作的业务摘要。 */
  changeSummary: string;
}

/** 系统配置历史列表的固定分页响应。 */
export interface SystemConfigVersionListResponse<TConfig> {
  /** 当前页的配置版本记录。 */
  list: SystemConfigVersion<TConfig>[];
  /** 满足查询条件的版本记录总数。 */
  total: number;
  /** 当前页码，从 1 开始。 */
  page: number;
  /** 当前页返回的记录数量上限。 */
  pageSize: number;
}

/** 系统设置页面所需的三个领域草稿概览。 */
export interface SystemSettingsOverviewResponse {
  /** 服务标准作业流程领域的当前草稿。 */
  sop: SystemConfigDraft<SopConfig>;
  /** 服务者评分阈值领域的当前草稿。 */
  ratingThreshold: SystemConfigDraft<RatingThresholdConfig>;
  /** 平台费用领域的当前草稿。 */
  fee: SystemConfigDraft<FeeConfig>;
}
