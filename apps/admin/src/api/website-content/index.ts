import type {
  ArchiveWebsiteMediaResponse,
  CreateWebsitePreviewRequest,
  CreateWebsitePreviewResponse,
  PublishWebsiteContentRequest,
  PublishWebsiteContentResponse,
  RestoreWebsiteContentRequest,
  SaveWebsiteContentDraftRequest,
  UploadWebsiteMediaResponse,
  WebsiteContentDiffResponse,
  WebsiteContentDraftResponse,
  WebsiteContentHistoryQuery,
  WebsiteContentHistoryResponse,
  WebsiteContentKey,
  WebsiteContentOverviewResponse,
  WebsiteContentVersion,
  WebsiteMediaListQuery,
  WebsiteMediaListResponse,
} from "@petcare/shared-types";
import { apiClient } from "../auth";

const WEBSITE_CONTENT_PATH = "/admin/website-content";

/** Cache identities for independently published Website Content units. */
export const websiteContentQueryKeys = {
  /** Overview of every fixed Website Content unit. */
  overview: () => ["website-content", "overview"] as const,
  /** Current editable immutable draft for one unit. */
  draft: (contentKey: WebsiteContentKey) => ["website-content", contentKey, "draft"] as const,
  /** Stable field-level difference between a draft and its published version. */
  diff: (contentKey: WebsiteContentKey) => ["website-content", contentKey, "diff"] as const,
  /** Paginated published history for one unit. */
  history: (contentKey: WebsiteContentKey, query?: WebsiteContentHistoryQuery) =>
    ["website-content", contentKey, "history", query ?? null] as const,
  /** One immutable historical version. */
  historyVersion: (contentKey: WebsiteContentKey, versionId: string) =>
    ["website-content", contentKey, "history", versionId] as const,
  /** Managed website media library query identity. */
  media: (query?: WebsiteMediaListQuery) => ["website-content", "media-assets", query ?? null] as const,
};

/** Lists every independently managed Website Content unit. */
export async function fetchWebsiteContentOverview(): Promise<WebsiteContentOverviewResponse> {
  const response = await apiClient.get<WebsiteContentOverviewResponse>(WEBSITE_CONTENT_PATH);

  return response.data;
}

/** Reads the current immutable draft for one Website Content unit. */
export async function fetchWebsiteContentDraft(
  contentKey: WebsiteContentKey,
): Promise<WebsiteContentDraftResponse> {
  const response = await apiClient.get<WebsiteContentDraftResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/draft`,
  );

  return response.data;
}

/** Saves a complete new immutable Website Content draft. */
export async function saveWebsiteContentDraft(
  contentKey: WebsiteContentKey,
  request: SaveWebsiteContentDraftRequest,
): Promise<WebsiteContentDraftResponse> {
  const response = await apiClient.put<WebsiteContentDraftResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/draft`,
    request,
  );

  return response.data;
}

/** Reads stable field-level differences between the current draft and published content. */
export async function fetchWebsiteContentDiff(
  contentKey: WebsiteContentKey,
): Promise<WebsiteContentDiffResponse> {
  const response = await apiClient.get<WebsiteContentDiffResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/diff`,
  );

  return response.data;
}

/** Lists published immutable history for one Website Content unit. */
export async function fetchWebsiteContentHistory(
  contentKey: WebsiteContentKey,
  query: WebsiteContentHistoryQuery,
): Promise<WebsiteContentHistoryResponse> {
  const response = await apiClient.get<WebsiteContentHistoryResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/history`,
    { params: query },
  );

  return response.data;
}

/** Reads one historical immutable Website Content version. */
export async function fetchWebsiteContentHistoryVersion(
  contentKey: WebsiteContentKey,
  versionId: string,
): Promise<WebsiteContentVersion> {
  const response = await apiClient.get<WebsiteContentVersion>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/history/${versionId}`,
  );

  return response.data;
}

/** Creates a short-lived preview URL pinned to a saved draft revision. */
export async function createWebsiteContentPreview(
  contentKey: WebsiteContentKey,
  request: CreateWebsitePreviewRequest,
): Promise<CreateWebsitePreviewResponse> {
  const response = await apiClient.post<CreateWebsitePreviewResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/previews`,
    request,
  );

  return response.data;
}

/** Explicitly publishes the currently saved draft of one Website Content unit. */
export async function publishWebsiteContent(
  contentKey: WebsiteContentKey,
  request: PublishWebsiteContentRequest,
): Promise<PublishWebsiteContentResponse> {
  const response = await apiClient.post<PublishWebsiteContentResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/publish`,
    request,
  );

  return response.data;
}

/** Copies a historical immutable version into a new editable draft without publishing it. */
export async function restoreWebsiteContent(
  contentKey: WebsiteContentKey,
  request: RestoreWebsiteContentRequest,
): Promise<WebsiteContentDraftResponse> {
  const response = await apiClient.post<WebsiteContentDraftResponse>(
    `${WEBSITE_CONTENT_PATH}/${contentKey}/restore`,
    request,
  );

  return response.data;
}

/** Lists registered Website Content media assets with a typed pagination query. */
export async function fetchWebsiteMediaAssets(
  query: WebsiteMediaListQuery,
): Promise<WebsiteMediaListResponse> {
  const response = await apiClient.get<WebsiteMediaListResponse>(
    `${WEBSITE_CONTENT_PATH}/media-assets`,
    { params: query },
  );

  return response.data;
}

/** Uploads one image using the Server's fixed multipart file field. */
export async function uploadWebsiteMediaAsset(file: File): Promise<UploadWebsiteMediaResponse> {
  const formData = new FormData();

  formData.append("file", file);

  const response = await apiClient.post<UploadWebsiteMediaResponse>(
    `${WEBSITE_CONTENT_PATH}/media-assets`,
    formData,
  );

  return response.data;
}

/** Archives an unreferenced Website Content media asset. */
export async function archiveWebsiteMediaAsset(
  assetId: string,
): Promise<ArchiveWebsiteMediaResponse> {
  const response = await apiClient.post<ArchiveWebsiteMediaResponse>(
    `${WEBSITE_CONTENT_PATH}/media-assets/${assetId}/archive`,
  );

  return response.data;
}
