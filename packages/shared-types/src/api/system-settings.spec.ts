import { describe, expect, it } from "vitest";
import {
  SYSTEM_CONFIG_ERROR_CODE,
  SYSTEM_CONFIG_STATUS,
  type FeeConfig,
  type RatingThresholdConfig,
  type SopConfig,
  type SystemConfigVersion,
  type SystemConfigVersionListResponse,
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
      orderConfirmation: "接单后确认服务时间与宠物需求",
      beforeService: "服务前核验宠物状态与服务信息",
      serviceExecution: "服务中遵循安全与操作规范",
      serviceCompletion: "服务完成后确认交付结果",
      serviceEvaluation: "邀请用户完成服务评价",
      violationRules: [],
    };

    expect([
      sop.orderConfirmation,
      sop.beforeService,
      sop.serviceExecution,
      sop.serviceCompletion,
      sop.serviceEvaluation,
    ]).toHaveLength(5);
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
});
