import type {
  AdminCommunityPostComment,
  AdminCommunityPostCommentListResponse,
  AdminCommunityPostCommentOfflineRequest,
  AdminCommunityPostReportResponse,
  AdminContentPostDetail,
  AdminContentPostListQuery,
  AdminContentPostListResponse,
  AdminContentPostStateRequest,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

/** 后台社区帖子 React Query 缓存键。 */
export const postQueryKeys = {
  /** 后台社区帖子缓存的根键。 */
  all: ["admin-content-posts"] as const,
  /** 构造指定社区帖子详情的缓存键。 */
  detail: (id: string) => ["admin-content-posts", "detail", id] as const,
  /** 构造指定社区帖子举报记录的缓存键。 */
  reports: (id: string) => ["admin-content-posts", "reports", id] as const,
  /** Constructs the cache key for one post's controlled comment context. */
  comments: (id: string) => ["admin-content-posts", "comments", id] as const,
};

/** 分页查询后台帖子内容。 */
export async function fetchAdminContentPosts(
  params: AdminContentPostListQuery,
): Promise<AdminContentPostListResponse> {
  const response = await apiClient.get<AdminContentPostListResponse>("/admin/content/posts", {
    params,
  });

  return response.data;
}

/** 获取指定社区帖子的后台详情与审核历史。 */
export async function fetchAdminContentPost(id: string): Promise<AdminContentPostDetail> {
  const response = await apiClient.get<AdminContentPostDetail>(`/admin/content/posts/${id}`);

  return response.data;
}

/** 获取指定社区帖子的举报人与受控原因。 */
export async function fetchAdminContentPostReports(
  id: string,
): Promise<AdminCommunityPostReportResponse> {
  const response = await apiClient.get<AdminCommunityPostReportResponse>(
    `/admin/content/posts/${id}/reports`,
  );

  return response.data;
}

/** Reads controlled comment and commenter context for one post. */
export async function fetchAdminContentPostComments(
  id: string,
): Promise<AdminCommunityPostCommentListResponse> {
  const response = await apiClient.get<AdminCommunityPostCommentListResponse>(
    `/admin/content/posts/${id}/comments`,
    { params: { page: 1, pageSize: 50 } },
  );

  return response.data;
}

/** Takes one visible comment offline with a required moderation reason. */
export async function offlineAdminContentPostComment(
  postId: string,
  commentId: string,
  request: AdminCommunityPostCommentOfflineRequest,
): Promise<AdminCommunityPostComment> {
  const response = await apiClient.post<AdminCommunityPostComment>(
    `/admin/content/posts/${postId}/comments/${commentId}/offline`,
    request,
  );

  return response.data;
}

/** 通过指定待审核社区帖子。 */
export async function approveAdminContentPost(
  id: string,
  request: AdminContentPostStateRequest,
): Promise<AdminContentPostDetail> {
  const response = await apiClient.post<AdminContentPostDetail>(
    `/admin/content/posts/${id}/approve`,
    request,
  );

  return response.data;
}

/** 驳回指定待审核社区帖子。 */
export async function rejectAdminContentPost(
  id: string,
  request: AdminContentPostStateRequest,
): Promise<AdminContentPostDetail> {
  const response = await apiClient.post<AdminContentPostDetail>(
    `/admin/content/posts/${id}/reject`,
    request,
  );

  return response.data;
}

/** 下架指定已发布社区帖子。 */
export async function offlineAdminContentPost(
  id: string,
  request: AdminContentPostStateRequest,
): Promise<AdminContentPostDetail> {
  const response = await apiClient.post<AdminContentPostDetail>(
    `/admin/content/posts/${id}/offline`,
    request,
  );

  return response.data;
}
