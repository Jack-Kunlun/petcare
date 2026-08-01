import { Injectable } from "@nestjs/common";
import {
  AdminServiceType,
  SOP_VIOLATION_SEVERITY,
  SopConfig,
  SopConfigKey,
} from "@petcare/shared-types";
import { ApiException } from "../../../common/http/api-exception";
import { ConfigDomainAdapter, PrismaTransaction } from "../publishing/config-domain.adapter";
import {
  systemConfigNotFound,
  systemConfigPersistenceFailed,
  systemConfigValidationFailed,
} from "../system-settings.errors";

const SEVERITIES = new Set(Object.values(SOP_VIOLATION_SEVERITY));
const MAX_TOTAL_DURATION_MINUTES = 480;

function requireIntegerInRange(value: number, minimum: number, maximum: number, message: string) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw systemConfigValidationFailed(message);
  }
}

/** 单个服务类型五步 SOP 及违规指引的强类型配置适配器。 */
@Injectable()
export class SopConfigAdapter implements ConfigDomainAdapter<SopConfig> {
  /** 单个服务类型使用的 SOP 配置键。 */
  readonly domain: SopConfigKey;
  /** 步骤和规则数组分别使用序号与唯一严重程度稳定匹配。 */
  readonly arrayKeyStrategies = [
    { arrayPath: "steps", keyPaths: ["stepNumber"] },
    { arrayPath: "violationRules", keyPaths: ["severity"] },
  ];

  /** 创建指定服务类型的 SOP 配置适配器。 */
  constructor(private readonly serviceType: AdminServiceType) {
    this.domain = `sop:${serviceType}`;
  }

  /** 从指定版本加载该服务类型的完整五步 SOP 与规则。 */
  async load(versionId: string, tx: PrismaTransaction): Promise<SopConfig> {
    try {
      const [steps, violationRules] = await Promise.all([
        tx.sopConfigStep.findMany({
          where: { configVersionId: versionId, serviceType: this.serviceType },
          orderBy: { stepNumber: "asc" },
        }),
        tx.sopViolationRule.findMany({
          where: { configVersionId: versionId },
          orderBy: { sortOrder: "asc" },
        }),
      ]);

      if (steps.length === 0) {
        throw systemConfigNotFound();
      }

      return {
        steps: steps.map((step) => ({
          stepNumber: step.stepNumber,
          stepName: step.stepName,
          instruction: step.instruction,
          expectedDurationMinutes: step.expectedDurationMinutes,
          minimumPhotoCount: step.minimumPhotoCount,
          videoRequired: step.videoRequired,
        })),
        violationRules: violationRules.map((rule) => ({
          severity: rule.severity as "minor" | "moderate" | "severe",
          description: rule.description,
          serviceFeeDeductionBps: rule.serviceFeeDeductionBps,
          ratingDeductionScore: rule.ratingDeductionScore,
          suspensionDays: rule.suspensionDays,
          retrainingRequired: rule.retrainingRequired,
          sortOrder: rule.sortOrder,
        })),
      };
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw systemConfigPersistenceFailed();
    }
  }

  /** 校验后原子覆盖指定版本的五步 SOP 与规则。 */
  async persist(versionId: string, config: SopConfig, tx: PrismaTransaction): Promise<void> {
    this.validate(config);

    try {
      await tx.sopConfigStep.deleteMany({ where: { configVersionId: versionId } });
      await tx.sopConfigStep.createMany({
        data: config.steps.map((step) => ({
          configVersionId: versionId,
          serviceType: this.serviceType,
          ...step,
        })),
      });
      await tx.sopViolationRule.deleteMany({ where: { configVersionId: versionId } });
      await tx.sopViolationRule.createMany({
        data: config.violationRules.map((rule) => ({ configVersionId: versionId, ...rule })),
      });
    } catch {
      throw systemConfigPersistenceFailed();
    }
  }

  /** 完整校验五步连续性、字段边界、重复内容、总时长和规则结构。 */
  validate(config: SopConfig): void {
    if (!Array.isArray(config.steps) || config.steps.length !== 5) {
      throw systemConfigValidationFailed("SOP 必须恰好包含 5 个步骤");
    }

    const stepNumbers = new Set<number>();
    const stepNames = new Set<string>();
    const instructions = new Set<string>();
    let totalDuration = 0;

    for (const step of config.steps) {
      requireIntegerInRange(step.stepNumber, 1, 5, "SOP 步骤序号必须为 1 至 5");
      stepNumbers.add(step.stepNumber);
      const name = typeof step.stepName === "string" ? step.stepName.trim() : "";
      const instruction = typeof step.instruction === "string" ? step.instruction.trim() : "";

      if (name.length < 2 || name.length > 20) {
        throw systemConfigValidationFailed("SOP 步骤名称长度必须在 2 至 20 个字符之间");
      }

      if (instruction.length < 10 || instruction.length > 500) {
        throw systemConfigValidationFailed("SOP 步骤说明长度必须在 10 至 500 个字符之间");
      }

      requireIntegerInRange(
        step.expectedDurationMinutes,
        1,
        240,
        "SOP 步骤时长必须在 1 至 240 分钟之间",
      );
      requireIntegerInRange(step.minimumPhotoCount, 0, 20, "SOP 最少照片数量必须在 0 至 20 之间");

      if (typeof step.videoRequired !== "boolean") {
        throw systemConfigValidationFailed("SOP 视频要求必须为布尔值");
      }

      if (stepNames.has(name) || instructions.has(instruction)) {
        throw systemConfigValidationFailed("SOP 步骤不得包含重复内容");
      }

      stepNames.add(name);
      instructions.add(instruction);
      totalDuration += step.expectedDurationMinutes;
    }

    if ([1, 2, 3, 4, 5].some((stepNumber) => !stepNumbers.has(stepNumber))) {
      throw systemConfigValidationFailed("SOP 步骤序号必须从 1 至 5 唯一连续");
    }

    if (totalDuration > MAX_TOTAL_DURATION_MINUTES) {
      throw systemConfigValidationFailed("SOP 总时长不得超过 480 分钟");
    }

    if (!Array.isArray(config.violationRules) || config.violationRules.length === 0) {
      throw systemConfigValidationFailed("SOP 必须包含至少一条完整违规规则");
    }

    const severities = new Set<string>();
    const descriptions = new Set<string>();
    const sortOrders = new Set<number>();

    for (const rule of config.violationRules) {
      if (!SEVERITIES.has(rule.severity)) {
        throw systemConfigValidationFailed("SOP 违规规则等级无效");
      }

      if (severities.has(rule.severity)) {
        throw systemConfigValidationFailed("SOP 违规规则等级不得重复");
      }

      const description = typeof rule.description === "string" ? rule.description.trim() : "";

      if (description.length < 10 || description.length > 500) {
        throw systemConfigValidationFailed("SOP 违规规则说明长度必须在 10 至 500 个字符之间");
      }

      if (descriptions.has(description)) {
        throw systemConfigValidationFailed("SOP 违规规则不得包含重复内容");
      }

      if (rule.serviceFeeDeductionBps !== null) {
        requireIntegerInRange(
          rule.serviceFeeDeductionBps,
          0,
          10000,
          "SOP 建议服务费扣减比例必须在 0 至 10000 万分比之间",
        );
      }

      requireIntegerInRange(
        rule.ratingDeductionScore,
        0,
        500,
        "SOP 建议评分扣减必须在 0 至 500 之间",
      );
      requireIntegerInRange(rule.suspensionDays, 0, 365, "SOP 建议暂停天数必须在 0 至 365 之间");

      if (typeof rule.retrainingRequired !== "boolean") {
        throw systemConfigValidationFailed("SOP 再培训建议必须为布尔值");
      }

      requireIntegerInRange(rule.sortOrder, 1, 100, "SOP 违规规则顺序必须为正整数");

      if (sortOrders.has(rule.sortOrder)) {
        throw systemConfigValidationFailed("SOP 违规规则顺序不得重复");
      }

      severities.add(rule.severity);
      descriptions.add(description);
      sortOrders.add(rule.sortOrder);
    }
  }

  /** 返回用于字段级差异比较的完整递归 SOP 摘要。 */
  summarize(config: SopConfig) {
    return {
      steps: config.steps.map((step) => ({ ...step })),
      violationRules: config.violationRules.map((rule) => ({ ...rule })),
    };
  }
}
