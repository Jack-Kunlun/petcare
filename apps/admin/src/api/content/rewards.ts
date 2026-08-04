import type {
  AdminContentRewardListQuery,
  AdminContentRewardListResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

/** 分页查询后台悬赏内容。 */
export async function fetchAdminContentRewards(
  params: AdminContentRewardListQuery,
): Promise<AdminContentRewardListResponse> {
  const response = await apiClient.get<AdminContentRewardListResponse>("/admin/content/rewards", {
    params,
  });

  return response.data;
}
