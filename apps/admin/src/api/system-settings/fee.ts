import type {
  FeeConfig,
  PublishSystemConfigRequest,
  PublishSystemConfigResponse,
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

const FEE_PATH = "/admin/system-settings/fee";

/** 获取当前生效的平台费用配置。 */
export async function fetchFeeCurrent(): Promise<SystemConfigVersion<FeeConfig>> {
  const response = await apiClient.get<SystemConfigVersion<FeeConfig>>(`${FEE_PATH}/current`);

  return response.data;
}

/** 获取当前可编辑的平台费用草稿。 */
export async function fetchFeeDraft(): Promise<SystemConfigDraft<FeeConfig>> {
  const response = await apiClient.get<SystemConfigDraft<FeeConfig>>(`${FEE_PATH}/draft`);

  return response.data;
}

/** 获取费用草稿与当前版本的差异。 */
export async function fetchFeeDiff(): Promise<SystemConfigDiffResponse> {
  const response = await apiClient.get<SystemConfigDiffResponse>(`${FEE_PATH}/diff`);

  return response.data;
}

/** 按统一分页条件查询平台费用配置发布历史。 */
export async function fetchFeeHistory(
  params: SystemConfigHistoryQuery,
): Promise<SystemConfigVersionListResponse<FeeConfig>> {
  const response = await apiClient.get<SystemConfigVersionListResponse<FeeConfig>>(`${FEE_PATH}/history`, {
    params,
  });

  return response.data;
}

/** 保存平台费用草稿。 */
export async function saveFeeDraft(
  request: SaveSystemConfigDraftRequest<FeeConfig>,
): Promise<SystemConfigDraft<FeeConfig>> {
  const response = await apiClient.put<SystemConfigDraft<FeeConfig>>(`${FEE_PATH}/draft`, request);

  return response.data;
}

/** 发布平台费用草稿。 */
export async function publishFeeDraft(
  request: PublishSystemConfigRequest,
): Promise<PublishSystemConfigResponse<FeeConfig>> {
  const response = await apiClient.post<PublishSystemConfigResponse<FeeConfig>>(
    `${FEE_PATH}/publish`,
    request,
  );

  return response.data;
}

/** 将平台费用历史版本恢复为新草稿。 */
export async function restoreFeeDraft(
  request: RestoreSystemConfigRequest,
): Promise<RestoreSystemConfigResponse<FeeConfig>> {
  const response = await apiClient.post<RestoreSystemConfigResponse<FeeConfig>>(
    `${FEE_PATH}/restore`,
    request,
  );

  return response.data;
}
