import type {
  AdminServiceType,
  FeeConfig,
  PublishSystemConfigRequest,
  RatingThresholdConfig,
  RestoreSystemConfigRequest,
  SaveSystemConfigDraftRequest,
  SopConfig,
  SystemConfigDiffResponse,
  SystemConfigDraft,
  SystemConfigVersion,
  SystemConfigVersionListResponse,
} from "@petcare/shared-types";
import axios from "axios";
import {
  fetchFeeCurrent,
  fetchFeeDiff,
  fetchFeeDraft,
  fetchFeeHistory,
  fetchFeeVersion,
  publishFeeDraft,
  restoreFeeDraft,
  saveFeeDraft,
} from "../../api/system-settings/fee";
import {
  fetchRatingThresholdCurrent,
  fetchRatingThresholdDiff,
  fetchRatingThresholdDraft,
  fetchRatingThresholdHistory,
  fetchRatingThresholdVersion,
  publishRatingThresholdDraft,
  restoreRatingThresholdDraft,
  saveRatingThresholdDraft,
} from "../../api/system-settings/rating-threshold";
import {
  fetchSopCurrent,
  fetchSopDiff,
  fetchSopDraft,
  fetchSopHistory,
  fetchSopVersion,
  publishSopDraft,
  restoreSopDraft,
  saveSopDraft,
} from "../../api/system-settings/sop";

export type SettingsPageDomain = "sop" | "rating_threshold" | "fee";
export type SettingsConfig = SopConfig | RatingThresholdConfig | FeeConfig;
export type SettingsVersion = SystemConfigVersion<SettingsConfig>;
export type SettingsDraft = SystemConfigDraft<SettingsConfig>;

export const settingsDomainMeta: Record<
  SettingsPageDomain,
  { label: string; editPermission: string; impact: string }
> = {
  sop: {
    label: "SOP 配置",
    editPermission: "system.sop_config",
    impact: "发布后，新开始的对应服务将采用这套五步流程；进行中的订单继续使用原版本快照。",
  },
  rating_threshold: {
    label: "评分阈值",
    editPermission: "system.threshold_config",
    impact: "发布后，新一轮服务者资格评估将使用新的窗口和评分阈值，可能影响预警或暂停接单结果。",
  },
  fee: {
    label: "费率设置",
    editPermission: "system.fee_config",
    impact: "发布后，新创建订单和提现将按新费率计算；既有订单的费用快照不会被追溯修改。",
  },
};

export function isSettingsPageDomain(value: string | undefined): value is SettingsPageDomain {
  return value === "sop" || value === "rating_threshold" || value === "fee";
}

function isNotFound(error: unknown): boolean {
  return (
    (axios.isAxiosError(error) && error.response?.status === 404) ||
    (typeof error === "object" &&
      error !== null &&
      "response" in error &&
      (error as { response?: { status?: number } }).response?.status === 404)
  );
}

export async function fetchDomainCurrent(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
): Promise<SettingsVersion> {
  if (domain === "sop") {
    return fetchSopCurrent(serviceType);
  }

  if (domain === "rating_threshold") {
    return fetchRatingThresholdCurrent();
  }

  return fetchFeeCurrent();
}

export async function fetchDomainDraft(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
): Promise<SettingsDraft | null> {
  try {
    if (domain === "sop") {
      return await fetchSopDraft(serviceType);
    }

    if (domain === "rating_threshold") {
      return await fetchRatingThresholdDraft();
    }

    return await fetchFeeDraft();
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function fetchDomainDiff(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
): Promise<SystemConfigDiffResponse> {
  if (domain === "sop") {
    return fetchSopDiff(serviceType);
  }

  if (domain === "rating_threshold") {
    return fetchRatingThresholdDiff();
  }

  return fetchFeeDiff();
}

export async function fetchDomainHistory(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
  pageSize = 20,
): Promise<SystemConfigVersionListResponse<SettingsConfig>> {
  const params = { page: 1, pageSize };

  if (domain === "sop") {
    return fetchSopHistory(serviceType, params);
  }

  if (domain === "rating_threshold") {
    return fetchRatingThresholdHistory(params);
  }

  return fetchFeeHistory(params);
}

/** 按领域与版本记录 ID 读取单个已发布历史版本。 */
export async function fetchDomainVersion(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
  versionId: string,
): Promise<SettingsVersion> {
  if (versionId === "latest") {
    return fetchDomainCurrent(domain, serviceType);
  }

  if (domain === "sop") {
    return fetchSopVersion(serviceType, versionId);
  }

  if (domain === "rating_threshold") {
    return fetchRatingThresholdVersion(versionId);
  }

  return fetchFeeVersion(versionId);
}

export async function saveDomainDraft(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
  request: SaveSystemConfigDraftRequest<SettingsConfig>,
): Promise<SettingsDraft> {
  if (domain === "sop") {
    return saveSopDraft(serviceType, { ...request, config: request.config as SopConfig });
  }

  if (domain === "rating_threshold") {
    return saveRatingThresholdDraft({
      ...request,
      config: request.config as RatingThresholdConfig,
    });
  }

  return saveFeeDraft({ ...request, config: request.config as FeeConfig });
}

export async function publishDomainDraft(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
  request: PublishSystemConfigRequest,
): Promise<SettingsVersion> {
  if (domain === "sop") {
    return publishSopDraft(serviceType, request);
  }

  if (domain === "rating_threshold") {
    return publishRatingThresholdDraft(request);
  }

  return publishFeeDraft(request);
}

export async function restoreDomainDraft(
  domain: SettingsPageDomain,
  serviceType: AdminServiceType,
  request: RestoreSystemConfigRequest,
): Promise<SettingsDraft> {
  if (domain === "sop") {
    return restoreSopDraft(serviceType, request);
  }

  if (domain === "rating_threshold") {
    return restoreRatingThresholdDraft(request);
  }

  return restoreFeeDraft(request);
}
