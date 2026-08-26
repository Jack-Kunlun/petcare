import type {
  PublicClassroomArticleDetail,
  PublicClassroomArticleListQuery,
  PublicClassroomArticleListResponse,
  WebsiteContentKey,
  WebsitePublicContent,
} from "@petcare/shared-types";
import { rawRequest } from "./request";

/** Reads a filtered page of currently published classroom articles. */
export function getClassroomArticles(
  query: PublicClassroomArticleListQuery,
): Promise<PublicClassroomArticleListResponse> {
  return rawRequest<PublicClassroomArticleListResponse>("/content/articles", { data: query });
}

/** Reads one currently published classroom article by its stable route value. */
export function getClassroomArticle(slug: string): Promise<PublicClassroomArticleDetail> {
  return rawRequest<PublicClassroomArticleDetail>(`/content/articles/${encodeURIComponent(slug)}`);
}

/** Reads the currently published public snapshot for one managed content key. */
export function getPublishedContent(contentKey: WebsiteContentKey): Promise<WebsitePublicContent> {
  return rawRequest<WebsitePublicContent>(`/website-content/${encodeURIComponent(contentKey)}`);
}
