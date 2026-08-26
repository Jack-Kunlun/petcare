import type {
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
  PublicClassroomArticleDetail,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
  WebsiteContentKey,
  WebsitePublicContent,
} from "@petcare/shared-types";
import { authorizedRequest } from "../state/session";
import { rawRequest } from "./request";

/** Submits a text-only community post for moderation. */
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
