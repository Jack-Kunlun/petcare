import type {
  PublishSystemConfigRequest,
  PublishSystemConfigResponse,
  RatingThresholdConfig,
  RestoreSystemConfigRequest,
  RestoreSystemConfigResponse,
  SaveSystemConfigDraftRequest,
  SystemConfigDiffResponse,
  SystemConfigDraft,
  SystemConfigHistoryQuery,
  SystemConfigVersion,
  SystemConfigVersionListResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

const RATING_THRESHOLD_PATH = "/admin/system-settings/rating-threshold";

/** 获取当前生效的服务者评分阈值配置。 */
export async function fetchRatingThresholdCurrent(): Promise<SystemConfigVersion<RatingThresholdConfig>> {
  const response = await apiClient.get<SystemConfigVersion<RatingThresholdConfig>>(
    `${RATING_THRESHOLD_PATH}/current`,
  );

  return response.data;
}

/** 获取当前可编辑的服务者评分阈值草稿。 */
export async function fetchRatingThresholdDraft(): Promise<SystemConfigDraft<RatingThresholdConfig>> {
  const response = await apiClient.get<SystemConfigDraft<RatingThresholdConfig>>(
    `${RATING_THRESHOLD_PATH}/draft`,
  );

  return response.data;
}

/** 获取评分阈值草稿与当前版本的差异。 */
export async function fetchRatingThresholdDiff(): Promise<SystemConfigDiffResponse> {
  const response = await apiClient.get<SystemConfigDiffResponse>(`${RATING_THRESHOLD_PATH}/diff`);

  return response.data;
}

/** 按统一分页条件查询评分阈值发布历史。 */
export async function fetchRatingThresholdHistory(
  params: SystemConfigHistoryQuery,
): Promise<SystemConfigVersionListResponse<RatingThresholdConfig>> {
  const response = await apiClient.get<SystemConfigVersionListResponse<RatingThresholdConfig>>(
    `${RATING_THRESHOLD_PATH}/history`,
    { params },
  );

  return response.data;
}

/** 保存服务者评分阈值草稿。 */
export async function saveRatingThresholdDraft(
  request: SaveSystemConfigDraftRequest<RatingThresholdConfig>,
): Promise<SystemConfigDraft<RatingThresholdConfig>> {
  const response = await apiClient.put<SystemConfigDraft<RatingThresholdConfig>>(
    `${RATING_THRESHOLD_PATH}/draft`,
    request,
  );

  return response.data;
}

/** 发布服务者评分阈值草稿。 */
export async function publishRatingThresholdDraft(
  request: PublishSystemConfigRequest,
): Promise<PublishSystemConfigResponse<RatingThresholdConfig>> {
  const response = await apiClient.post<PublishSystemConfigResponse<RatingThresholdConfig>>(
    `${RATING_THRESHOLD_PATH}/publish`,
    request,
  );

  return response.data;
}

/** 将评分阈值历史版本恢复为新草稿。 */
export async function restoreRatingThresholdDraft(
  request: RestoreSystemConfigRequest,
): Promise<RestoreSystemConfigResponse<RatingThresholdConfig>> {
  const response = await apiClient.post<RestoreSystemConfigResponse<RatingThresholdConfig>>(
    `${RATING_THRESHOLD_PATH}/restore`,
    request,
  );

  return response.data;
}
