import type {
  AdminClassroomArticleDetail,
  AdminClassroomArticleListQuery,
  AdminClassroomArticleListResponse,
  AdminClassroomArticleStateRequest,
  CreateAdminClassroomArticleRequest,
  UpdateAdminClassroomArticleRequest,
  UploadAdminClassroomArticleMediaResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

/** 后台课堂文章 React Query 缓存键。 */
export const articleQueryKeys = {
  /** 后台课堂文章缓存的根键。 */
  all: ["admin-content-articles"] as const,
  /** 构造指定课堂文章详情的缓存键。 */
  detail: (id: string) => ["admin-content-articles", "detail", id] as const,
};

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

/** 获取指定课堂文章的后台详情。 */
export async function fetchAdminClassroomArticle(id: string): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.get<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}`,
  );

  return response.data;
}

/** 新建课堂文章草稿。 */
export async function createAdminClassroomArticle(
  request: CreateAdminClassroomArticleRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.post<AdminClassroomArticleDetail>(
    "/admin/content/articles",
    request,
  );

  return response.data;
}

/** 更新已有课堂文章。 */
export async function updateAdminClassroomArticle(
  id: string,
  request: UpdateAdminClassroomArticleRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.put<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}`,
    request,
  );

  return response.data;
}

/** 发布课堂文章。 */
export async function publishAdminClassroomArticle(
  id: string,
  request: AdminClassroomArticleStateRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.post<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}/publish`,
    request,
  );

  return response.data;
}

/** 下线课堂文章。 */
export async function offlineAdminClassroomArticle(
  id: string,
  request: AdminClassroomArticleStateRequest,
): Promise<AdminClassroomArticleDetail> {
  const response = await apiClient.post<AdminClassroomArticleDetail>(
    `/admin/content/articles/${id}/offline`,
    request,
  );

  return response.data;
}

/** 上传课堂文章使用的受管理图片素材。 */
export async function uploadAdminClassroomArticleMedia(
  file: File,
): Promise<UploadAdminClassroomArticleMediaResponse> {
  const formData = new FormData();

  formData.set("file", file);

  const response = await apiClient.post<UploadAdminClassroomArticleMediaResponse>(
    "/admin/content/articles/media-assets",
    formData,
  );

  return response.data;
}
