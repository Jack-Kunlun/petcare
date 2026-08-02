import type { AdminServiceType } from "./admin";

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
export type SystemConfigDomain =
  | Exclude<
      (typeof SYSTEM_CONFIG_DOMAIN)[keyof typeof SYSTEM_CONFIG_DOMAIN],
      typeof SYSTEM_CONFIG_DOMAIN.SOP
    >
  | SopConfigKey;

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
  /** 配置内容未通过领域完整性校验。 */
  VALIDATION_FAILED: "SYSTEM_CONFIG_VALIDATION_FAILED",
  /** 配置记录或指定版本不存在。 */
  NOT_FOUND: "SYSTEM_CONFIG_NOT_FOUND",
  /** 配置领域数据持久化失败。 */
  PERSISTENCE_FAILED: "SYSTEM_CONFIG_PERSISTENCE_FAILED",
} as const;

/** 系统配置接口返回的稳定错误码。 */
export type SystemConfigErrorCode =
  (typeof SYSTEM_CONFIG_ERROR_CODE)[keyof typeof SYSTEM_CONFIG_ERROR_CODE];

/** 单个服务类型 SOP 使用的配置键。 */
export type SopConfigKey = `sop:${AdminServiceType}`;

/** 单个服务类型 SOP 的一个有序步骤。 */
export interface SopConfigStep {
  /** 从一开始且连续的步骤序号。 */
  stepNumber: number;
  /** 后台展示的步骤名称。 */
  stepName: string;
  /** 服务者执行该步骤时遵循的完整说明。 */
  instruction: string;
  /** 该步骤的合理预计时长，单位为分钟。 */
  expectedDurationMinutes: number;
  /** 该步骤要求上传的最少照片数量。 */
  minimumPhotoCount: number;
  /** 该步骤是否要求上传视频。 */
  videoRequired: boolean;
}

/** SOP 违规规则支持的严重程度业务值。 */
export const SOP_VIOLATION_SEVERITY = {
  /** 轻微偏差，通常只需提醒和人工复核。 */
  MINOR: "minor",
  /** 中等违规，需要明确警告和人工处理。 */
  MODERATE: "moderate",
  /** 严重违规，需要升级人工处置。 */
  SEVERE: "severe",
} as const;

/** SOP 违规规则的严重程度。 */
export type SopViolationSeverity =
  (typeof SOP_VIOLATION_SEVERITY)[keyof typeof SOP_VIOLATION_SEVERITY];

/** SOP 违规规则及其人工处置指引。 */
export interface SopViolationRule {
  /** 规则唯一业务等级。 */
  severity: SopViolationSeverity;
  /** 违规条件和建议处理说明。 */
  description: string;
  /** 建议扣减服务费的整数万分比；为空表示不建议扣减。 */
  serviceFeeDeductionBps: number | null;
  /** 建议扣减的整数评分百分值。 */
  ratingDeductionScore: number;
  /** 建议暂停接单的天数。 */
  suspensionDays: number;
  /** 是否建议要求服务者重新培训。 */
  retrainingRequired: boolean;
  /** 后台展示规则时使用的稳定顺序。 */
  sortOrder: number;
}

/** 单个服务类型的服务标准作业流程配置。 */
export interface SopConfig {
  /** 固定五个且从一开始连续的服务步骤。 */
  steps: SopConfigStep[];
  /** 仅供人工处置参考、不直接产生财务或信用副作用的违规规则。 */
  violationRules: SopViolationRule[];
}

/** 服务者评分阈值配置。 */
export interface RatingThresholdConfig {
  /** 用于计算评分的最近已评价订单数量。 */
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
  /** 提现手续费比例，使用 0 至 1000 的整数万分比。 */
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

/** 发布系统配置成功后的版本响应。 */
export type PublishSystemConfigResponse<TConfig> = SystemConfigVersion<TConfig>;

/** 恢复历史配置成功后的草稿响应。 */
export type RestoreSystemConfigResponse<TConfig> = SystemConfigDraft<TConfig>;

/** 系统配置摘要允许使用的 JSON 基础值。 */
export type SystemConfigSummaryPrimitive = string | number | boolean | null;

/** 系统配置摘要中的递归 JSON 对象。 */
export interface SystemConfigSummaryObject {
  /** 对象字段及其递归摘要值。 */
  [key: string]: SystemConfigSummaryValue;
}

/** 系统配置摘要中的递归 JSON 数组。 */
export type SystemConfigSummaryArray = SystemConfigSummaryValue[];

/** 系统配置领域适配器输出的递归 JSON 摘要值。 */
export type SystemConfigSummaryValue =
  SystemConfigSummaryPrimitive | SystemConfigSummaryObject | SystemConfigSummaryArray;

/** 数组字段使用的显式稳定业务键策略。 */
export interface SystemConfigArrayKeyStrategy {
  /** 数组字段在摘要中的点分路径。 */
  arrayPath: string;
  /** 组成稳定业务键的一个或多个数组项内部点分路径。 */
  keyPaths: string[];
}

/** 配置差异项支持的变化类型。 */
export const SYSTEM_CONFIG_DIFF_CHANGE_TYPE = {
  /** 新增字段或数组项。 */
  ADDED: "added",
  /** 已有字段内容发生修改。 */
  MODIFIED: "modified",
  /** 删除字段或数组项。 */
  REMOVED: "removed",
} as const;

/** 配置差异项支持的变化类型。 */
export type SystemConfigDiffChangeType =
  (typeof SYSTEM_CONFIG_DIFF_CHANGE_TYPE)[keyof typeof SYSTEM_CONFIG_DIFF_CHANGE_TYPE];

/** 两个配置版本之间的单字段差异。 */
export interface SystemConfigDiff {
  /** 发生变化的配置字段稳定路径。 */
  path: string;
  /** 供管理端展示的字段标签。 */
  label: string;
  /** 变更前的摘要值；新增时不存在。 */
  before: SystemConfigSummaryValue | undefined;
  /** 变更后的摘要值；删除时不存在。 */
  after: SystemConfigSummaryValue | undefined;
  /** 字段的变化类型。 */
  changeType: SystemConfigDiffChangeType;
}

/** 执行领域无关配置差异比较的请求。 */
export interface SystemConfigDiffRequest {
  /** 变更前的递归配置摘要。 */
  before: SystemConfigSummaryValue;
  /** 变更后的递归配置摘要。 */
  after: SystemConfigSummaryValue;
  /** 所有数组字段的显式稳定业务键策略。 */
  arrayKeyStrategies: SystemConfigArrayKeyStrategy[];
}

/** 配置差异比较的固定数组响应。 */
export type SystemConfigDiffResponse = SystemConfigDiff[];

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

/** 发布系统配置草稿的内部执行命令。 */
export interface PublishSystemConfigCommand extends PublishSystemConfigRequest {
  /** 执行发布的管理员唯一标识。 */
  actorId: string;
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

/** 将历史版本恢复为草稿的内部执行命令。 */
export interface RestoreSystemConfigCommand extends RestoreSystemConfigRequest {
  /** 执行恢复的管理员唯一标识。 */
  actorId: string;
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

/** 系统配置历史列表的固定分页查询参数。 */
export interface SystemConfigHistoryQuery {
  /** 当前页码，从一开始。 */
  page: number;
  /** 每页返回记录数量上限。 */
  pageSize: number;
}

/** 系统设置页面中单个配置键的发布与草稿概览。 */
export interface SystemSettingDomainOverview<TConfig> {
  /** 当前生效的已发布版本；尚未发布时为空。 */
  current: SystemConfigVersion<TConfig> | null;
  /** 当前可编辑草稿；没有待发布变更时为空。 */
  draft: SystemConfigDraft<TConfig> | null;
  /** 管理员进入领域后需要处理的提示文案。 */
  pendingActions: string[];
}

/** 系统设置页面所需的全部配置键概览。 */
export interface SystemSettingsOverviewResponse {
  /** 按服务类型拆分的服务标准作业流程概览。 */
  sop: Record<AdminServiceType, SystemSettingDomainOverview<SopConfig>>;
  /** 服务者评分阈值领域概览。 */
  ratingThreshold: SystemSettingDomainOverview<RatingThresholdConfig>;
  /** 平台费用领域概览。 */
  fee: SystemSettingDomainOverview<FeeConfig>;
}
