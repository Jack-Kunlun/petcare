import type { SystemSettingsOverviewResponse } from "@petcare/shared-types";
import { apiClient } from "../auth";

/** 获取系统设置控制台的全部领域概览。 */
export async function fetchSystemSettingsOverview(): Promise<SystemSettingsOverviewResponse> {
  const response = await apiClient.get<SystemSettingsOverviewResponse>(
    "/admin/system-settings/overview",
  );

  return response.data;
}
