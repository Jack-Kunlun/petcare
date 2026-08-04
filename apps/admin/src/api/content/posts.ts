import type {
  AdminContentPostListQuery,
  AdminContentPostListResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

/** 分页查询后台帖子内容。 */
export async function fetchAdminContentPosts(
  params: AdminContentPostListQuery,
): Promise<AdminContentPostListResponse> {
  const response = await apiClient.get<AdminContentPostListResponse>("/admin/content/posts", {
    params,
  });

  return response.data;
}
