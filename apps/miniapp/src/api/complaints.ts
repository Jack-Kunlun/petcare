import type {
  ComplaintDetail,
  ComplaintListQuery,
  ComplaintListResponse,
  CreateComplaintRequest,
  SubmitComplaintStatementRequest,
  WithdrawComplaintRequest,
} from "@petcare/shared-types";
import { requestWithSession } from "../auth/auth.session";

const complaintEndpoints = {
  collection: "/complaints",
  detail: (id: string) => `/complaints/${id}`,
  respond: (id: string) => `/complaints/${id}/respond`,
  appeals: (id: string) => `/complaints/${id}/appeals`,
  withdraw: (id: string) => `/complaints/${id}/withdraw`,
} as const;

/** 为订单创建投诉并返回最新投诉详情。 */
export function createComplaint(request: CreateComplaintRequest): Promise<ComplaintDetail> {
  return requestWithSession(complaintEndpoints.collection, {
    method: "POST",
    data: request,
  });
}

/** 分页查询当前用户参与的投诉。 */
export function listMyComplaints(query: ComplaintListQuery): Promise<ComplaintListResponse> {
  const search = `page=${query.page}&pageSize=${query.pageSize}`;

  return requestWithSession(`${complaintEndpoints.collection}?${search}`);
}

/** 获取当前用户可见的投诉详情。 */
export function getComplaintDetail(id: string): Promise<ComplaintDetail> {
  return requestWithSession(complaintEndpoints.detail(id));
}

/** 提交被投诉方的首次回应并返回最新详情。 */
export function submitFirstResponse(
  id: string,
  request: SubmitComplaintStatementRequest,
): Promise<ComplaintDetail> {
  return requestWithSession(complaintEndpoints.respond(id), {
    method: "POST",
    data: request,
  });
}

/** 提交投诉当事方的二次申诉并返回最新详情。 */
export function submitSecondAppeal(
  id: string,
  request: SubmitComplaintStatementRequest,
): Promise<ComplaintDetail> {
  return requestWithSession(complaintEndpoints.appeals(id), {
    method: "POST",
    data: request,
  });
}

/** 在初裁前撤回投诉并返回最新详情。 */
export function withdrawComplaint(
  id: string,
  request: WithdrawComplaintRequest,
): Promise<ComplaintDetail> {
  return requestWithSession(complaintEndpoints.withdraw(id), {
    method: "POST",
    data: request,
  });
}
