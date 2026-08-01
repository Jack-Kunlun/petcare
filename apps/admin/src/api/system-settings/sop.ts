import type {
  AdminServiceType,
  PublishSystemConfigRequest,
  PublishSystemConfigResponse,
  RestoreSystemConfigRequest,
  RestoreSystemConfigResponse,
  SaveSystemConfigDraftRequest,
  SopConfig,
  SystemConfigDiffResponse,
  SystemConfigDraft,
  SystemConfigHistoryQuery,
  SystemConfigVersion,
  SystemConfigVersionListResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

function sopPath(serviceType: AdminServiceType, resource: string): string {
  return `/admin/system-settings/sop/${serviceType}/${resource}`;
}

/** 获取指定服务类型当前生效的 SOP 配置。 */
export async function fetchSopCurrent(serviceType: AdminServiceType): Promise<SystemConfigVersion<SopConfig>> {
  const response = await apiClient.get<SystemConfigVersion<SopConfig>>(sopPath(serviceType, "current"));

  return response.data;
}

/** 获取指定服务类型当前可编辑的 SOP 草稿。 */
export async function fetchSopDraft(serviceType: AdminServiceType): Promise<SystemConfigDraft<SopConfig>> {
  const response = await apiClient.get<SystemConfigDraft<SopConfig>>(sopPath(serviceType, "draft"));

  return response.data;
}

/** 获取指定服务类型 SOP 草稿与当前版本的差异。 */
export async function fetchSopDiff(serviceType: AdminServiceType): Promise<SystemConfigDiffResponse> {
  const response = await apiClient.get<SystemConfigDiffResponse>(sopPath(serviceType, "diff"));

  return response.data;
}

/** 按统一分页条件查询指定服务类型的 SOP 发布历史。 */
export async function fetchSopHistory(
  serviceType: AdminServiceType,
  params: SystemConfigHistoryQuery,
): Promise<SystemConfigVersionListResponse<SopConfig>> {
  const response = await apiClient.get<SystemConfigVersionListResponse<SopConfig>>(
    sopPath(serviceType, "history"),
    { params },
  );

  return response.data;
}

/** 保存指定服务类型的 SOP 草稿。 */
export async function saveSopDraft(
  serviceType: AdminServiceType,
  request: SaveSystemConfigDraftRequest<SopConfig>,
): Promise<SystemConfigDraft<SopConfig>> {
  const response = await apiClient.put<SystemConfigDraft<SopConfig>>(sopPath(serviceType, "draft"), request);

  return response.data;
}

/** 发布指定服务类型的 SOP 草稿。 */
export async function publishSopDraft(
  serviceType: AdminServiceType,
  request: PublishSystemConfigRequest,
): Promise<PublishSystemConfigResponse<SopConfig>> {
  const response = await apiClient.post<PublishSystemConfigResponse<SopConfig>>(
    sopPath(serviceType, "publish"),
    request,
  );

  return response.data;
}

/** 将指定服务类型的历史 SOP 版本恢复为新草稿。 */
export async function restoreSopDraft(
  serviceType: AdminServiceType,
  request: RestoreSystemConfigRequest,
): Promise<RestoreSystemConfigResponse<SopConfig>> {
  const response = await apiClient.post<RestoreSystemConfigResponse<SopConfig>>(
    sopPath(serviceType, "restore"),
    request,
  );

  return response.data;
}
