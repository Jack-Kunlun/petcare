import { describe, expect, it } from "vitest";
import {
  SYSTEM_CONFIG_ERROR_CODE,
  SYSTEM_CONFIG_DIFF_CHANGE_TYPE,
  SYSTEM_CONFIG_STATUS,
  type FeeConfig,
  type RatingThresholdConfig,
  type RestoreSystemConfigResponse,
  type SopConfig,
  type SystemConfigArrayKeyStrategy,
  type SystemConfigDiffRequest,
  type SystemConfigDiffResponse,
  type SystemConfigSummaryValue,
  type SystemConfigVersion,
  type SystemConfigVersionListResponse,
  type PublishSystemConfigResponse,
} from "./system-settings";

describe("system settings contracts", () => {
  it("uses integers for scores, rates, and amounts", () => {
    const rating: RatingThresholdConfig = {
      evaluationWindow: 30,
      minimumSampleSize: 5,
      warningScore: 350,
      suspensionScore: 300,
      retrainingRequirement: "完成平台重新培训并通过管理员审核",
    };
    const fee: FeeConfig = {
      platformCommissionBps: 1000,
      rewardServiceFeeCents: 200,
      withdrawalFeeBps: 100,
      minimumWithdrawalFeeCents: 100,
    };

    expect(Number.isInteger(rating.warningScore)).toBe(true);
    expect(Object.values(fee).every(Number.isInteger)).toBe(true);
  });

  it("fixes publish statuses and stable error codes", () => {
    expect(SYSTEM_CONFIG_STATUS).toEqual({
      DRAFT: "draft",
      PUBLISHED: "published",
      SUPERSEDED: "superseded",
    });
    expect(SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT).toBe("SYSTEM_CONFIG_VERSION_CONFLICT");
  });

  it("shares all five SOP steps", () => {
    const sop: SopConfig = {
      steps: Array.from({ length: 5 }, (_, index) => ({
        stepNumber: index + 1,
        stepName: `步骤${index + 1}`,
        instruction: `这是步骤${index + 1}的完整执行说明，确保服务过程安全规范。`,
        expectedDurationMinutes: 10,
        minimumPhotoCount: 1,
        videoRequired: false,
      })),
      violationRules: [],
    };

    expect(sop.steps).toHaveLength(5);
  });

  it("uses the fixed pagination shape for version history", () => {
    const version: SystemConfigVersion<FeeConfig> = {
      id: "fee-version-1",
      domain: "fee",
      version: 1,
      status: "superseded",
      config: {
        platformCommissionBps: 1000,
        rewardServiceFeeCents: 200,
        withdrawalFeeBps: 100,
        minimumWithdrawalFeeCents: 100,
      },
      changeSummary: "初始化费用规则",
      publishedBy: "admin-1",
      publishedAt: "2026-08-01T00:00:00.000Z",
    };
    const response: SystemConfigVersionListResponse<FeeConfig> = {
      list: [version],
      total: 1,
      page: 1,
      pageSize: 20,
    };

    expect(Object.keys(response)).toEqual(["list", "total", "page", "pageSize"]);
    expect(response.list[0]?.status).toBe("superseded");
  });

  it("支持递归摘要、复合数组稳定键和固定差异响应", () => {
    const before: SystemConfigSummaryValue = {
      rules: [{ scope: { type: "walking" }, stepNumber: 1, enabled: true }, null],
    };
    const strategies: SystemConfigArrayKeyStrategy[] = [
      { arrayPath: "rules", keyPaths: ["scope.type", "stepNumber"] },
    ];
    const request: SystemConfigDiffRequest = {
      before,
      after: { rules: [{ scope: { type: "walking" }, stepNumber: 1, enabled: false }] },
      arrayKeyStrategies: strategies,
    };
    const response: SystemConfigDiffResponse = [
      {
        path: "rules[scope.type=walking,stepNumber=1].enabled",
        label: "enabled",
        before: true,
        after: false,
        changeType: "modified",
      },
    ];
    const fee: FeeConfig = {
      platformCommissionBps: 1000,
      rewardServiceFeeCents: 200,
      withdrawalFeeBps: 100,
      minimumWithdrawalFeeCents: 100,
    };
    const published: PublishSystemConfigResponse<FeeConfig> = {
      id: "fee-v2",
      domain: "fee",
      version: 2,
      status: "published",
      config: fee,
      changeSummary: "更新配置",
      publishedBy: "admin-1",
      publishedAt: "2026-08-01T00:00:00.000Z",
    };
    const restored: RestoreSystemConfigResponse<FeeConfig> = {
      id: "fee-draft",
      domain: "fee",
      revision: 1,
      config: fee,
      changeSummary: "恢复配置",
      updatedBy: "admin-1",
      updatedAt: "2026-08-01T01:00:00.000Z",
    };

    expect(request.arrayKeyStrategies).toEqual(strategies);
    expect(SYSTEM_CONFIG_DIFF_CHANGE_TYPE.MODIFIED).toBe("modified");
    expect(response[0]?.changeType).toBe("modified");
    expect(published.status).toBe("published");
    expect(restored.revision).toBe(1);
  });
});
