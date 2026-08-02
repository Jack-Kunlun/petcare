import type {
  FeeConfig,
  RatingThresholdConfig,
  SopConfig,
  SystemConfigDraft,
  SystemConfigVersion,
  SystemConfigVersionListResponse,
  SystemSettingsOverviewResponse,
} from "@petcare/shared-types";
import { SYSTEM_CONFIG_ERROR_CODE } from "@petcare/shared-types";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import { isSystemConfigVersionConflict } from "./client";
import {
  fetchFeeCurrent,
  fetchFeeDiff,
  fetchFeeDraft,
  fetchFeeHistory,
  fetchFeeVersion,
  publishFeeDraft,
  restoreFeeDraft,
  saveFeeDraft,
} from "./fee";
import { fetchSystemSettingsOverview } from "./overview";
import {
  fetchRatingThresholdCurrent,
  fetchRatingThresholdDiff,
  fetchRatingThresholdDraft,
  fetchRatingThresholdHistory,
  fetchRatingThresholdVersion,
  publishRatingThresholdDraft,
  restoreRatingThresholdDraft,
  saveRatingThresholdDraft,
} from "./rating-threshold";
import {
  fetchSopCurrent,
  fetchSopDiff,
  fetchSopDraft,
  fetchSopHistory,
  fetchSopVersion,
  publishSopDraft,
  restoreSopDraft,
  saveSopDraft,
} from "./sop";

vi.mock("../auth", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@petcare/shared-types", () => ({
  SYSTEM_CONFIG_ERROR_CODE: {
    VERSION_CONFLICT: "SHARED_SYSTEM_CONFIG_VERSION_CONFLICT",
  },
}));

const fee: FeeConfig = {
  platformCommissionBps: 1000,
  rewardServiceFeeCents: 200,
  withdrawalFeeBps: 100,
  minimumWithdrawalFeeCents: 100,
};

const ratingThreshold: RatingThresholdConfig = {
  evaluationWindow: 30,
  minimumSampleSize: 5,
  warningScore: 350,
  suspensionScore: 300,
  retrainingRequirement: "完成服务质量再培训",
};

const sop: SopConfig = { steps: [], violationRules: [] };

const feeDraft: SystemConfigDraft<FeeConfig> = {
  id: "fee-draft",
  domain: "fee",
  revision: 2,
  config: fee,
  changeSummary: "调整平台抽成",
  updatedBy: "admin-1",
  updatedAt: "2026-08-02T00:00:00.000Z",
};

const feeVersion: SystemConfigVersion<FeeConfig> = {
  id: "fee-version",
  domain: "fee",
  version: 1,
  status: "published",
  config: fee,
  changeSummary: "初始配置",
  publishedBy: "admin-1",
  publishedAt: "2026-08-01T00:00:00.000Z",
};

describe("system settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the unwrapped system settings overview", async () => {
    const overview = {} as SystemSettingsOverviewResponse;

    vi.mocked(apiClient.get).mockResolvedValue({ data: overview });

    await expect(fetchSystemSettingsOverview()).resolves.toBe(overview);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/system-settings/overview");
  });

  it("uses the explicit service type for every SOP endpoint", async () => {
    const history: SystemConfigVersionListResponse<SopConfig> = {
      list: [],
      total: 0,
      page: 2,
      pageSize: 20,
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: history });
    vi.mocked(apiClient.put).mockResolvedValue({ data: feeDraft });
    vi.mocked(apiClient.post).mockResolvedValue({ data: feeVersion });

    await fetchSopCurrent("feeding");
    await fetchSopDraft("feeding");
    await fetchSopDiff("feeding");
    await fetchSopHistory("feeding", { page: 2, pageSize: 20 });
    await fetchSopVersion("feeding", "sop-feeding-v1");
    await saveSopDraft("feeding", { revision: 2, config: sop, changeSummary: "更新步骤" });
    await publishSopDraft("feeding", { revision: 2, idempotencyKey: "sop-publish-01" });
    await restoreSopDraft("feeding", { version: 1, revision: 0, changeSummary: "恢复历史版本" });

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/system-settings/sop/feeding/current");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/system-settings/sop/feeding/draft");
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/admin/system-settings/sop/feeding/diff");
    expect(apiClient.get).toHaveBeenNthCalledWith(4, "/admin/system-settings/sop/feeding/history", {
      params: { page: 2, pageSize: 20 },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(
      5,
      "/admin/system-settings/sop/feeding/history/sop-feeding-v1",
    );
    expect(apiClient.put).toHaveBeenCalledWith("/admin/system-settings/sop/feeding/draft", {
      revision: 2,
      config: sop,
      changeSummary: "更新步骤",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/admin/system-settings/sop/feeding/publish",
      {
        revision: 2,
        idempotencyKey: "sop-publish-01",
      },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/admin/system-settings/sop/feeding/restore",
      {
        version: 1,
        revision: 0,
        changeSummary: "恢复历史版本",
      },
    );
  });

  it("uses the rating threshold routes and typed payloads", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    vi.mocked(apiClient.put).mockResolvedValue({ data: feeDraft });
    vi.mocked(apiClient.post).mockResolvedValue({ data: feeVersion });

    await fetchRatingThresholdCurrent();
    await fetchRatingThresholdDraft();
    await fetchRatingThresholdDiff();
    await fetchRatingThresholdHistory({ page: 1, pageSize: 10 });
    await fetchRatingThresholdVersion("rating-v1");
    await saveRatingThresholdDraft({
      revision: 1,
      config: ratingThreshold,
      changeSummary: "调整阈值",
    });
    await publishRatingThresholdDraft({ revision: 1, idempotencyKey: "rating-publish-01" });
    await restoreRatingThresholdDraft({ version: 1, revision: 0, changeSummary: "恢复阈值" });

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      "/admin/system-settings/rating-threshold/current",
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      "/admin/system-settings/rating-threshold/draft",
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      3,
      "/admin/system-settings/rating-threshold/diff",
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      4,
      "/admin/system-settings/rating-threshold/history",
      {
        params: { page: 1, pageSize: 10 },
      },
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      5,
      "/admin/system-settings/rating-threshold/history/rating-v1",
    );
    expect(apiClient.put).toHaveBeenCalledWith("/admin/system-settings/rating-threshold/draft", {
      revision: 1,
      config: ratingThreshold,
      changeSummary: "调整阈值",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/admin/system-settings/rating-threshold/publish",
      {
        revision: 1,
        idempotencyKey: "rating-publish-01",
      },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/admin/system-settings/rating-threshold/restore",
      {
        version: 1,
        revision: 0,
        changeSummary: "恢复阈值",
      },
    );
  });

  it("uses the fee routes and typed payloads", async () => {
    const history: SystemConfigVersionListResponse<FeeConfig> = {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: history });
    vi.mocked(apiClient.put).mockResolvedValue({ data: feeDraft });
    vi.mocked(apiClient.post).mockResolvedValue({ data: feeVersion });

    await fetchFeeCurrent();
    await fetchFeeDraft();
    await fetchFeeDiff();
    await fetchFeeHistory({ page: 1, pageSize: 20 });
    await fetchFeeVersion("fee-v1");
    await saveFeeDraft({ revision: 2, config: fee, changeSummary: "调整平台抽成" });
    await publishFeeDraft({ revision: 2, idempotencyKey: "fee-publish-01" });
    await restoreFeeDraft({ version: 1, revision: 0, changeSummary: "恢复历史费率" });

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/system-settings/fee/current");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/system-settings/fee/draft");
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/admin/system-settings/fee/diff");
    expect(apiClient.get).toHaveBeenNthCalledWith(4, "/admin/system-settings/fee/history", {
      params: { page: 1, pageSize: 20 },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(5, "/admin/system-settings/fee/history/fee-v1");
    expect(apiClient.put).toHaveBeenCalledWith("/admin/system-settings/fee/draft", {
      revision: 2,
      config: fee,
      changeSummary: "调整平台抽成",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/admin/system-settings/fee/publish", {
      revision: 2,
      idempotencyKey: "fee-publish-01",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/admin/system-settings/fee/restore", {
      version: 1,
      revision: 0,
      changeSummary: "恢复历史费率",
    });
  });

  it("identifies only the stable version-conflict error code", () => {
    const conflict = new axios.AxiosError("conflict", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 409,
      data: {
        code: SYSTEM_CONFIG_ERROR_CODE.VERSION_CONFLICT,
        message: "版本冲突",
        data: null,
        meta: {},
      },
    } as never);
    const sameMessageButDifferentCode = new axios.AxiosError(
      "conflict",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 409,
        data: { code: "OTHER_CONFLICT", message: "版本冲突", data: null, meta: {} },
      } as never,
    );

    expect(isSystemConfigVersionConflict(conflict)).toBe(true);
    expect(isSystemConfigVersionConflict(sameMessageButDifferentCode)).toBe(false);
    expect(isSystemConfigVersionConflict(new Error("SYSTEM_CONFIG_VERSION_CONFLICT"))).toBe(false);
  });
});
