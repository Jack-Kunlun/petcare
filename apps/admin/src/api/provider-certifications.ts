import type {
  AdminProviderCertificationDetail,
  AdminProviderCertificationListQuery,
  AdminProviderCertificationListResponse,
  RejectProviderCertificationRequest,
} from "@petcare/shared-types";
import { apiClient } from "./auth";

/** 按筛选条件查询后台宠托师认证申请分页列表。 */
export async function fetchAdminProviderCertifications(
  params: AdminProviderCertificationListQuery,
): Promise<AdminProviderCertificationListResponse> {
  const response = await apiClient.get<AdminProviderCertificationListResponse>(
    "/admin/provider-certifications",
    { params },
  );

  return response.data;
}

/** 查询单个宠托师认证申请详情。 */
export async function fetchAdminProviderCertification(
  id: string,
): Promise<AdminProviderCertificationDetail> {
  const response = await apiClient.get<AdminProviderCertificationDetail>(
    `/admin/provider-certifications/${id}`,
  );

  return response.data;
}

/** 审核通过待审核宠托师认证申请。 */
export async function approveAdminProviderCertification(
  id: string,
): Promise<AdminProviderCertificationDetail> {
  const response = await apiClient.post<AdminProviderCertificationDetail>(
    `/admin/provider-certifications/${id}/approve`,
  );

  return response.data;
}

/** 填写原因并驳回待审核宠托师认证申请。 */
export async function rejectAdminProviderCertification(
  id: string,
  request: RejectProviderCertificationRequest,
): Promise<AdminProviderCertificationDetail> {
  const response = await apiClient.post<AdminProviderCertificationDetail>(
    `/admin/provider-certifications/${id}/reject`,
    request,
  );

  return response.data;
}
