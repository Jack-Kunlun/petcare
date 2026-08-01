import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FeeConfig,
  PublishSystemConfigRequest,
  RatingThresholdConfig,
  RestoreSystemConfigRequest,
  SaveSystemConfigDraftRequest,
  SOP_VIOLATION_SEVERITY,
  SopConfig,
  SopConfigStep,
  SopViolationRule,
  SopViolationSeverity,
  SystemConfigDiff,
  SystemConfigDraft,
  SystemConfigHistoryQuery,
  SystemConfigStatus,
  SystemConfigVersion,
  SystemConfigVersionListResponse,
  SystemSettingDomainOverview,
  SystemSettingsOverviewResponse,
} from "@petcare/shared-types";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

const CONFIG_STATUSES: SystemConfigStatus[] = ["draft", "published", "superseded"];
const RULE_SEVERITIES: SopViolationSeverity[] = Object.values(SOP_VIOLATION_SEVERITY);

/** 单个 SOP 步骤的请求与响应模型。 */
export class SopConfigStepDto implements SopConfigStep {
  /** 从一开始且连续的步骤序号。 */
  @ApiProperty({ minimum: 1, maximum: 5, example: 1 })
  @IsInt()
  @Min(1)
  @Max(5)
  stepNumber: number;

  /** 后台展示的步骤名称。 */
  @ApiProperty({ minLength: 2, maxLength: 20, example: "进门消毒" })
  @IsString()
  @Length(2, 20)
  stepName: string;

  /** 服务者执行步骤时遵循的完整说明。 */
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @Length(10, 500)
  instruction: string;

  /** 步骤预计时长，单位为分钟。 */
  @ApiProperty({ minimum: 1, maximum: 240, example: 10 })
  @IsInt()
  @Min(1)
  @Max(240)
  expectedDurationMinutes: number;

  /** 要求上传的最少照片数量。 */
  @ApiProperty({ minimum: 0, maximum: 20, example: 1 })
  @IsInt()
  @Min(0)
  @Max(20)
  minimumPhotoCount: number;

  /** 是否要求上传视频。 */
  @ApiProperty({ example: false })
  @IsBoolean()
  videoRequired: boolean;
}

/** SOP 违规规则的请求与响应模型。 */
export class SopViolationRuleDto implements SopViolationRule {
  /** 规则唯一业务等级。 */
  @ApiProperty({ enum: RULE_SEVERITIES, example: "minor" })
  @IsIn(RULE_SEVERITIES)
  severity: SopViolationSeverity;

  /** 违规条件与人工处理指引。 */
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @Length(10, 500)
  description: string;

  /** 建议服务费扣减万分比；为空表示不建议扣减。 */
  @ApiProperty({ nullable: true, minimum: 0, maximum: 10000, example: 1000 })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(10000)
  serviceFeeDeductionBps: number | null;

  /** 建议评分扣减整数百分值。 */
  @ApiProperty({ minimum: 0, maximum: 500, example: 0 })
  @IsInt()
  @Min(0)
  @Max(500)
  ratingDeductionScore: number;

  /** 建议暂停接单天数。 */
  @ApiProperty({ minimum: 0, maximum: 365, example: 0 })
  @IsInt()
  @Min(0)
  @Max(365)
  suspensionDays: number;

  /** 是否建议重新培训。 */
  @ApiProperty({ example: false })
  @IsBoolean()
  retrainingRequired: boolean;

  /** 规则后台展示顺序。 */
  @ApiProperty({ minimum: 1, maximum: 100, example: 1 })
  @IsInt()
  @Min(1)
  @Max(100)
  sortOrder: number;
}

/** 单个服务类型的完整 SOP 配置模型。 */
export class SopConfigDto implements SopConfig {
  /** 恰好五个有序服务步骤。 */
  @ApiProperty({ type: [SopConfigStepDto], minItems: 5, maxItems: 5 })
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SopConfigStepDto)
  steps: SopConfigStepDto[];

  /** 仅供人工处置参考的结构化违规规则。 */
  @ApiProperty({ type: [SopViolationRuleDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SopViolationRuleDto)
  violationRules: SopViolationRuleDto[];
}

/** 评分阈值配置模型。 */
export class RatingThresholdConfigDto implements RatingThresholdConfig {
  /** 评分统计窗口，单位为天。 */
  @ApiProperty({ minimum: 5, maximum: 100, example: 30 })
  @IsInt()
  @Min(5)
  @Max(100)
  evaluationWindow: number;

  /** 阈值生效所需最少样本数。 */
  @ApiProperty({ minimum: 1, maximum: 100, example: 5 })
  @IsInt()
  @Min(1)
  @Max(100)
  minimumSampleSize: number;

  /** 触发预警的整数评分百分值。 */
  @ApiProperty({ minimum: 100, maximum: 500, example: 350 })
  @IsInt()
  @Min(100)
  @Max(500)
  warningScore: number;

  /** 触发暂停接单的整数评分百分值。 */
  @ApiProperty({ minimum: 100, maximum: 500, example: 300 })
  @IsInt()
  @Min(100)
  @Max(500)
  suspensionScore: number;

  /** 恢复服务前必须完成的再培训要求。 */
  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @Length(1, 500)
  @Matches(/\S/u)
  retrainingRequirement: string;
}

/** 平台费用配置模型。 */
export class FeeConfigDto implements FeeConfig {
  /** 平台佣金整数万分比。 */
  @ApiProperty({ minimum: 0, maximum: 5000, example: 1000 })
  @IsInt()
  @Min(0)
  @Max(5000)
  platformCommissionBps: number;

  /** 悬赏订单固定服务费，单位为分。 */
  @ApiProperty({ minimum: 0, example: 200 })
  @IsInt()
  @Min(0)
  rewardServiceFeeCents: number;

  /** 提现手续费整数万分比。 */
  @ApiProperty({ minimum: 0, maximum: 5000, example: 100 })
  @IsInt()
  @Min(0)
  @Max(5000)
  withdrawalFeeBps: number;

  /** 最低提现手续费，单位为分。 */
  @ApiProperty({ minimum: 0, example: 100 })
  @IsInt()
  @Min(0)
  minimumWithdrawalFeeCents: number;
}

/** 保存 SOP 草稿请求。 */
export class SaveSopConfigDraftDto implements SaveSystemConfigDraftRequest<SopConfig> {
  /** 客户端最后读取到的乐观锁修订号。 */
  @ApiProperty({ minimum: 0, example: 0 })
  @IsInt()
  @Min(0)
  revision: number;

  /** 待保存的单服务类型 SOP 配置。 */
  @ApiProperty({ type: SopConfigDto })
  @ValidateNested()
  @Type(() => SopConfigDto)
  config: SopConfigDto;

  /** 本次修改的非空业务摘要。 */
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  @Matches(/\S/u)
  changeSummary: string;
}

/** 保存评分阈值草稿请求。 */
export class SaveRatingThresholdDraftDto implements SaveSystemConfigDraftRequest<RatingThresholdConfig> {
  /** 客户端最后读取到的乐观锁修订号。 */
  @ApiProperty({ minimum: 0, example: 0 })
  @IsInt()
  @Min(0)
  revision: number;

  /** 待保存的评分阈值配置。 */
  @ApiProperty({ type: RatingThresholdConfigDto })
  @ValidateNested()
  @Type(() => RatingThresholdConfigDto)
  config: RatingThresholdConfigDto;

  /** 本次修改的非空业务摘要。 */
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  @Matches(/\S/u)
  changeSummary: string;
}

/** 保存费用草稿请求。 */
export class SaveFeeConfigDraftDto implements SaveSystemConfigDraftRequest<FeeConfig> {
  /** 客户端最后读取到的乐观锁修订号。 */
  @ApiProperty({ minimum: 0, example: 0 })
  @IsInt()
  @Min(0)
  revision: number;

  /** 待保存的费用配置。 */
  @ApiProperty({ type: FeeConfigDto })
  @ValidateNested()
  @Type(() => FeeConfigDto)
  config: FeeConfigDto;

  /** 本次修改的非空业务摘要。 */
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  @Matches(/\S/u)
  changeSummary: string;
}

/** 发布配置草稿请求。 */
export class PublishSystemConfigDto implements PublishSystemConfigRequest {
  /** 待发布草稿的乐观锁修订号。 */
  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  /** 防止重复发布的唯一请求键。 */
  @ApiProperty({ minLength: 8, maxLength: 200, example: "settings-fee-20260802-1" })
  @IsString()
  @Length(8, 200)
  @Matches(/\S/u)
  idempotencyKey: string;
}

/** 从历史版本恢复为新草稿请求。 */
export class RestoreSystemConfigDto implements RestoreSystemConfigRequest {
  /** 要恢复的已发布业务版本号。 */
  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  version: number;

  /** 新草稿创建前要求的修订号，固定为零。 */
  @ApiProperty({ minimum: 0, maximum: 0, example: 0 })
  @IsInt()
  @Min(0)
  @Max(0)
  revision: number;

  /** 本次恢复操作的非空业务摘要。 */
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  @Matches(/\S/u)
  changeSummary: string;
}

/** 系统配置历史分页查询。 */
export class SystemConfigHistoryQueryDto implements SystemConfigHistoryQuery {
  /** 当前页码，从一开始。 */
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  /** 每页记录数。 */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

/** 单字段系统配置差异响应模型。 */
export class SystemConfigDiffDto implements SystemConfigDiff {
  /** 发生变化的稳定字段路径。 */
  @ApiProperty({ example: "steps[stepNumber=1].stepName" })
  path: string;

  /** 管理端展示字段标签。 */
  @ApiProperty({ example: "stepName" })
  label: string;

  /** 变更前递归摘要值。 */
  @ApiProperty({ nullable: true })
  before: SystemConfigDiff["before"];

  /** 变更后递归摘要值。 */
  @ApiProperty({ nullable: true })
  after: SystemConfigDiff["after"];

  /** 字段变化类型。 */
  @ApiProperty({ enum: ["added", "modified", "removed"] })
  changeType: SystemConfigDiff["changeType"];
}

/** SOP 草稿响应模型。 */
export class SopConfigDraftResponseDto implements SystemConfigDraft<SopConfig> {
  /** 草稿唯一标识。 */
  @ApiProperty() id: string;
  /** SOP 配置键。 */
  @ApiProperty({ example: "sop:feeding" }) domain: SystemConfigDraft<SopConfig>["domain"];
  /** 乐观锁修订号。 */
  @ApiProperty() revision: number;
  /** 单服务类型 SOP 配置。 */
  @ApiProperty({ type: SopConfigDto }) config: SopConfigDto;
  /** 变更摘要。 */
  @ApiProperty() changeSummary: string;
  /** 最后保存管理员标识。 */
  @ApiProperty() updatedBy: string;
  /** 最后保存时间。 */
  @ApiProperty({ format: "date-time" }) updatedAt: string;
}

/** 评分阈值草稿响应模型。 */
export class RatingThresholdDraftResponseDto implements SystemConfigDraft<RatingThresholdConfig> {
  /** 草稿唯一标识。 */
  @ApiProperty() id: string;
  /** 评分阈值配置键。 */
  @ApiProperty({ example: "rating_threshold" })
  domain: SystemConfigDraft<RatingThresholdConfig>["domain"];
  /** 乐观锁修订号。 */
  @ApiProperty() revision: number;
  /** 评分阈值配置。 */
  @ApiProperty({ type: RatingThresholdConfigDto }) config: RatingThresholdConfigDto;
  /** 变更摘要。 */
  @ApiProperty() changeSummary: string;
  /** 最后保存管理员标识。 */
  @ApiProperty() updatedBy: string;
  /** 最后保存时间。 */
  @ApiProperty({ format: "date-time" }) updatedAt: string;
}

/** 费用草稿响应模型。 */
export class FeeConfigDraftResponseDto implements SystemConfigDraft<FeeConfig> {
  /** 草稿唯一标识。 */
  @ApiProperty() id: string;
  /** 费用配置键。 */
  @ApiProperty({ example: "fee" }) domain: SystemConfigDraft<FeeConfig>["domain"];
  /** 乐观锁修订号。 */
  @ApiProperty() revision: number;
  /** 费用配置。 */
  @ApiProperty({ type: FeeConfigDto }) config: FeeConfigDto;
  /** 变更摘要。 */
  @ApiProperty() changeSummary: string;
  /** 最后保存管理员标识。 */
  @ApiProperty() updatedBy: string;
  /** 最后保存时间。 */
  @ApiProperty({ format: "date-time" }) updatedAt: string;
}

/** SOP 已发布版本响应模型。 */
export class SopConfigVersionResponseDto implements SystemConfigVersion<SopConfig> {
  /** 版本记录唯一标识。 */
  @ApiProperty() id: string;
  /** SOP 配置键。 */
  @ApiProperty({ example: "sop:feeding" }) domain: SystemConfigVersion<SopConfig>["domain"];
  /** 递增业务版本号。 */
  @ApiProperty() version: number;
  /** 版本状态。 */
  @ApiProperty({ enum: CONFIG_STATUSES }) status: SystemConfigStatus;
  /** 单服务类型 SOP 配置。 */
  @ApiProperty({ type: SopConfigDto }) config: SopConfigDto;
  /** 变更摘要。 */
  @ApiProperty() changeSummary: string;
  /** 发布管理员标识。 */
  @ApiProperty() publishedBy: string;
  /** 发布时间。 */
  @ApiProperty({ format: "date-time" }) publishedAt: string;
}

/** 评分阈值已发布版本响应模型。 */
export class RatingThresholdVersionResponseDto implements SystemConfigVersion<RatingThresholdConfig> {
  /** 版本记录唯一标识。 */
  @ApiProperty() id: string;
  /** 评分阈值配置键。 */
  @ApiProperty({ example: "rating_threshold" })
  domain: SystemConfigVersion<RatingThresholdConfig>["domain"];
  /** 递增业务版本号。 */
  @ApiProperty() version: number;
  /** 版本状态。 */
  @ApiProperty({ enum: CONFIG_STATUSES }) status: SystemConfigStatus;
  /** 评分阈值配置。 */
  @ApiProperty({ type: RatingThresholdConfigDto }) config: RatingThresholdConfigDto;
  /** 变更摘要。 */
  @ApiProperty() changeSummary: string;
  /** 发布管理员标识。 */
  @ApiProperty() publishedBy: string;
  /** 发布时间。 */
  @ApiProperty({ format: "date-time" }) publishedAt: string;
}

/** 费用已发布版本响应模型。 */
export class FeeConfigVersionResponseDto implements SystemConfigVersion<FeeConfig> {
  /** 版本记录唯一标识。 */
  @ApiProperty() id: string;
  /** 费用配置键。 */
  @ApiProperty({ example: "fee" }) domain: SystemConfigVersion<FeeConfig>["domain"];
  /** 递增业务版本号。 */
  @ApiProperty() version: number;
  /** 版本状态。 */
  @ApiProperty({ enum: CONFIG_STATUSES }) status: SystemConfigStatus;
  /** 费用配置。 */
  @ApiProperty({ type: FeeConfigDto }) config: FeeConfigDto;
  /** 变更摘要。 */
  @ApiProperty() changeSummary: string;
  /** 发布管理员标识。 */
  @ApiProperty() publishedBy: string;
  /** 发布时间。 */
  @ApiProperty({ format: "date-time" }) publishedAt: string;
}

/** SOP 历史版本固定分页响应。 */
export class SopConfigHistoryResponseDto implements SystemConfigVersionListResponse<SopConfig> {
  /** 当前页版本记录。 */
  @ApiProperty({ type: [SopConfigVersionResponseDto] }) list: SopConfigVersionResponseDto[];
  /** 满足条件的记录总数。 */
  @ApiProperty() total: number;
  /** 当前页码。 */
  @ApiProperty() page: number;
  /** 每页记录上限。 */
  @ApiProperty() pageSize: number;
}

/** 评分阈值历史版本固定分页响应。 */
export class RatingThresholdHistoryResponseDto implements SystemConfigVersionListResponse<RatingThresholdConfig> {
  /** 当前页版本记录。 */
  @ApiProperty({ type: [RatingThresholdVersionResponseDto] })
  list: RatingThresholdVersionResponseDto[];
  /** 满足条件的记录总数。 */
  @ApiProperty() total: number;
  /** 当前页码。 */
  @ApiProperty() page: number;
  /** 每页记录上限。 */
  @ApiProperty() pageSize: number;
}

/** 费用历史版本固定分页响应。 */
export class FeeConfigHistoryResponseDto implements SystemConfigVersionListResponse<FeeConfig> {
  /** 当前页版本记录。 */
  @ApiProperty({ type: [FeeConfigVersionResponseDto] }) list: FeeConfigVersionResponseDto[];
  /** 满足条件的记录总数。 */
  @ApiProperty() total: number;
  /** 当前页码。 */
  @ApiProperty() page: number;
  /** 每页记录上限。 */
  @ApiProperty() pageSize: number;
}

/** 单个配置键的概览 Swagger 模型。 */
export class SystemSettingDomainOverviewDto<
  TConfig,
> implements SystemSettingDomainOverview<TConfig> {
  /** 当前发布版本。 */
  current: SystemConfigVersion<TConfig> | null;
  /** 当前可编辑草稿。 */
  draft: SystemConfigDraft<TConfig> | null;
  /** 待处理提示。 */
  @ApiProperty({ type: [String] }) pendingActions: string[];
}

/** 单个 SOP 配置键的概览响应模型。 */
export class SopSettingOverviewDto extends SystemSettingDomainOverviewDto<SopConfig> {
  /** 当前发布版本。 */
  @ApiProperty({ type: SopConfigVersionResponseDto, nullable: true })
  declare current: SopConfigVersionResponseDto | null;
  /** 当前可编辑草稿。 */
  @ApiProperty({ type: SopConfigDraftResponseDto, nullable: true })
  declare draft: SopConfigDraftResponseDto | null;
}

/** 评分阈值配置键的概览响应模型。 */
export class RatingSettingOverviewDto extends SystemSettingDomainOverviewDto<RatingThresholdConfig> {
  /** 当前发布版本。 */
  @ApiProperty({ type: RatingThresholdVersionResponseDto, nullable: true })
  declare current: RatingThresholdVersionResponseDto | null;
  /** 当前可编辑草稿。 */
  @ApiProperty({ type: RatingThresholdDraftResponseDto, nullable: true })
  declare draft: RatingThresholdDraftResponseDto | null;
}

/** 费用配置键的概览响应模型。 */
export class FeeSettingOverviewDto extends SystemSettingDomainOverviewDto<FeeConfig> {
  /** 当前发布版本。 */
  @ApiProperty({ type: FeeConfigVersionResponseDto, nullable: true })
  declare current: FeeConfigVersionResponseDto | null;
  /** 当前可编辑草稿。 */
  @ApiProperty({ type: FeeConfigDraftResponseDto, nullable: true })
  declare draft: FeeConfigDraftResponseDto | null;
}

/** 三种服务类型的 SOP 概览响应模型。 */
export class SopSettingsOverviewDto {
  /** 上门喂养 SOP 概览。 */
  @ApiProperty({ type: SopSettingOverviewDto }) feeding: SopSettingOverviewDto;
  /** 遛宠 SOP 概览。 */
  @ApiProperty({ type: SopSettingOverviewDto }) walking: SopSettingOverviewDto;
  /** 陪玩 SOP 概览。 */
  @ApiProperty({ type: SopSettingOverviewDto }) playing: SopSettingOverviewDto;
}

/** 系统设置控制台完整概览响应模型。 */
export class SystemSettingsOverviewResponseDto implements SystemSettingsOverviewResponse {
  /** 按服务类型拆分的 SOP 概览。 */
  @ApiProperty({ type: SopSettingsOverviewDto }) sop: SopSettingsOverviewDto;
  /** 评分阈值概览。 */
  @ApiProperty({ type: RatingSettingOverviewDto }) ratingThreshold: RatingSettingOverviewDto;
  /** 费用配置概览。 */
  @ApiProperty({ type: FeeSettingOverviewDto }) fee: FeeSettingOverviewDto;
}
