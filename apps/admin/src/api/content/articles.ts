import type {
  AdminClassroomArticleListQuery,
  AdminClassroomArticleListResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

/** 分页查询后台课堂文章。 */
export async function fetchAdminClassroomArticles(
  params: AdminClassroomArticleListQuery,
): Promise<AdminClassroomArticleListResponse> {
  const response = await apiClient.get<AdminClassroomArticleListResponse>(
    "/admin/content/articles",
    { params },
  );

  return response.data;
}
