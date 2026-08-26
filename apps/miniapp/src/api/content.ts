import type {
  CommunityMediaAsset,
  CommunityPostReportReceipt,
  CreateCommunityPostReportRequest,
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
  PublicClassroomArticleDetail,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
  PublicCommunityPostDetail,
  PublicCommunityPostListQuery,
  PublicCommunityPostListResponse,
  WebsiteContentKey,
  WebsitePublicContent,
} from "@petcare/shared-types";
import { authorizedRequest, authorizedUpload } from "../state/session";
import type { UploadProgressHandler } from "./request";
import { rawRequest } from "./request";

/** Uploads one community image with authenticated native progress updates. */
export function uploadCommunityMedia(
  filePath: string,
  onProgress?: UploadProgressHandler,
): Promise<CommunityMediaAsset> {
  return authorizedUpload("/community/media-assets", filePath, "file", {}, onProgress);
}

/** Invalidates one unbound community image removed from the local draft. */
export function discardCommunityMedia(assetId: string): Promise<void> {
  return authorizedRequest(`/community/media-assets/${encodeURIComponent(assetId)}/discard`, {
    method: "POST",
  });
}

/** Submits one community post for moderation. */
export function createCommunityPost(
  request: CreateCommunityPostRequest,
): Promise<MyCommunityPostListItem> {
  return authorizedRequest("/community/posts", { method: "POST", data: request });
}

/** Reads the authenticated author's own posts and moderation states. */
export function getMyCommunityPosts(
  query: MyCommunityPostListQuery,
): Promise<MyCommunityPostListResponse> {
  return authorizedRequest("/community/posts/mine", { data: query });
}

/** Soft-deletes one post owned by the authenticated author. */
export function deleteCommunityPost(id: string): Promise<void> {
  return authorizedRequest(`/community/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Reports one currently published community post as the authenticated user. */
export function reportCommunityPost(
  id: string,
  request: CreateCommunityPostReportRequest,
): Promise<CommunityPostReportReceipt> {
  return authorizedRequest(`/community/posts/${encodeURIComponent(id)}/reports`, {
    method: "POST",
    data: request,
  });
}

/** Reads a page of currently published community posts. */
export function getCommunityPosts(
  query: PublicCommunityPostListQuery,
): Promise<PublicCommunityPostListResponse> {
  return rawRequest<PublicCommunityPostListResponse>("/content/community-posts", { data: query });
}

/** Reads one currently published community post. */
export function getCommunityPost(id: string): Promise<PublicCommunityPostDetail> {
  return rawRequest<PublicCommunityPostDetail>(
    `/content/community-posts/${encodeURIComponent(id)}`,
  );
}

/** Reads a filtered page of currently published classroom articles. */
export function getClassroomArticles(
  query: PublicClassroomArticleListQuery,
): Promise<PublicClassroomArticleListResponse> {
  const data = {
    page: query.page,
    pageSize: query.pageSize,
    ...(query.keyword ? { keyword: query.keyword } : {}),
    ...(query.category ? { category: query.category } : {}),
  };

  return rawRequest<PublicClassroomArticleListResponse>("/content/articles", { data });
}

/** Reads one currently published classroom article by its stable route value. */
export function getClassroomArticle(slug: string): Promise<PublicClassroomArticleDetail> {
  return rawRequest<PublicClassroomArticleDetail>(`/content/articles/${encodeURIComponent(slug)}`);
}

/** Reads the currently published public snapshot for one managed content key. */
export function getPublishedContent(contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
  return rawRequest<WebsitePublicContent>(`/website-content/${encodeURIComponent(contentKey)}`);
}
