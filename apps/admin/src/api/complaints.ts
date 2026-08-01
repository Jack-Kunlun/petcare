import type {
  AdminComplaintListQuery,
  AdminComplaintListResponse,
  AdminComplaintDetail,
  ClaimComplaintRequest,
  DisputeExecutionTaskListResponse,
  RetryDisputeExecutionTaskResponse,
  SubmitDisputeDecisionRequest,
  TransferComplaintRequest,
} from "@petcare/shared-types";
import { apiClient } from "./auth";

/** 查询符合筛选条件的后台投诉纠纷分页列表。 */
export async function fetchAdminComplaints(
  params: AdminComplaintListQuery,
): Promise<AdminComplaintListResponse> {
  const response = await apiClient.get<AdminComplaintListResponse>("/admin/complaints", { params });

  return response.data;
}

/** 查询指定投诉纠纷的后台详情。 */
export async function fetchAdminComplaint(id: string): Promise<AdminComplaintDetail> {
  const response = await apiClient.get<AdminComplaintDetail>(`/admin/complaints/${id}`);

  return response.data;
}

/** 认领指定投诉纠纷案件。 */
export async function claimAdminComplaint(
  id: string,
  request: ClaimComplaintRequest,
): Promise<AdminComplaintDetail> {
  const response = await apiClient.post<AdminComplaintDetail>(
    `/admin/complaints/${id}/claim`,
    request,
  );

  return response.data;
}

/** 将投诉纠纷案件转交给指定管理员。 */
export async function transferAdminComplaint(
  id: string,
  request: TransferComplaintRequest,
): Promise<AdminComplaintDetail> {
  const response = await apiClient.post<AdminComplaintDetail>(
    `/admin/complaints/${id}/transfer`,
    request,
  );

  return response.data;
}

/** 提交投诉纠纷的初审裁决。 */
export async function submitInitialDecision(
  id: string,
  request: SubmitDisputeDecisionRequest,
): Promise<AdminComplaintDetail> {
  const response = await apiClient.post<AdminComplaintDetail>(
    `/admin/complaints/${id}/decisions/initial`,
    request,
  );

  return response.data;
}

/** 提交投诉纠纷的终审裁决。 */
export async function submitFinalDecision(
  id: string,
  request: SubmitDisputeDecisionRequest,
): Promise<AdminComplaintDetail> {
  const response = await apiClient.post<AdminComplaintDetail>(
    `/admin/complaints/${id}/decisions/final`,
    request,
  );

  return response.data;
}

/** 查询投诉纠纷的裁决执行任务分页列表。 */
export async function fetchExecutionTasks(
  complaintId: string,
  params?: Pick<AdminComplaintListQuery, "page" | "pageSize">,
): Promise<DisputeExecutionTaskListResponse> {
  const response = await apiClient.get<DisputeExecutionTaskListResponse>(
    `/admin/complaints/${complaintId}/execution-tasks`,
    { params },
  );

  return response.data;
}

/** 重试指定投诉纠纷下失败的裁决执行任务。 */
export async function retryExecutionTask(
  complaintId: string,
  taskId: string,
): Promise<RetryDisputeExecutionTaskResponse> {
  const response = await apiClient.post<RetryDisputeExecutionTaskResponse>(
    `/admin/complaints/${complaintId}/execution-tasks/${taskId}/retry`,
  );

  return response.data;
}
