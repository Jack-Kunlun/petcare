import type {
  CreateWebsitePreviewRequest,
  PublishWebsiteContentRequest,
  RestoreWebsiteContentRequest,
  SaveWebsiteContentDraftRequest,
  WebsiteContentHistoryQuery,
  WebsiteContentKey,
  WebsiteContentVersion,
  WebsiteMediaListQuery,
} from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import {
  archiveWebsiteMediaAsset,
  createWebsiteContentPreview,
  fetchWebsiteContentDiff,
  fetchWebsiteContentDraft,
  fetchWebsiteContentHistory,
  fetchWebsiteContentHistoryVersion,
  fetchWebsiteContentOverview,
  fetchWebsiteMediaAssets,
  publishWebsiteContent,
  restoreWebsiteContent,
  saveWebsiteContentDraft,
  uploadWebsiteMediaAsset,
  websiteContentQueryKeys,
} from ".";

vi.mock("../auth", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

const contentKey: WebsiteContentKey = "home";
const version = {} as WebsiteContentVersion;
const saveRequest = {} as SaveWebsiteContentDraftRequest;
const previewRequest: CreateWebsitePreviewRequest = { revision: 2 };
const publishRequest: PublishWebsiteContentRequest = {
  revision: 2,
  idempotencyKey: "publish-home-2",
  changeSummary: "Publish the approved homepage copy.",
};
const restoreRequest: RestoreWebsiteContentRequest = {
  versionId: "history-1",
  revision: 2,
  changeSummary: "Restore the previously approved version.",
};
const historyQuery: WebsiteContentHistoryQuery = { page: 2, pageSize: 20 };
const mediaQuery: WebsiteMediaListQuery = { page: 1, pageSize: 20, status: "active" };

describe("website content API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses typed Admin routes, request bodies, queries, and the fixed multipart field", async () => {
    const file = new File(["image"], "petcare.webp", { type: "image/webp" });

    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    vi.mocked(apiClient.put).mockResolvedValue({ data: version });
    vi.mocked(apiClient.post).mockResolvedValue({ data: version });

    await fetchWebsiteContentOverview();
    await fetchWebsiteContentDraft(contentKey);
    await saveWebsiteContentDraft(contentKey, saveRequest);
    await fetchWebsiteContentDiff(contentKey);
    await fetchWebsiteContentHistory(contentKey, historyQuery);
    await fetchWebsiteContentHistoryVersion(contentKey, "history-1");
    await createWebsiteContentPreview(contentKey, previewRequest);
    await publishWebsiteContent(contentKey, publishRequest);
    await restoreWebsiteContent(contentKey, restoreRequest);
    await fetchWebsiteMediaAssets(mediaQuery);
    await uploadWebsiteMediaAsset(file);
    await archiveWebsiteMediaAsset("asset-1");

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/website-content");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/website-content/home/draft");
    expect(apiClient.put).toHaveBeenCalledWith("/admin/website-content/home/draft", saveRequest);
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/admin/website-content/home/diff");
    expect(apiClient.get).toHaveBeenNthCalledWith(4, "/admin/website-content/home/history", {
      params: historyQuery,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(
      5,
      "/admin/website-content/home/history/history-1",
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/admin/website-content/home/previews",
      previewRequest,
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/admin/website-content/home/publish",
      publishRequest,
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      3,
      "/admin/website-content/home/restore",
      restoreRequest,
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(6, "/admin/website-content/media-assets", {
      params: mediaQuery,
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      4,
      "/admin/website-content/media-assets",
      expect.any(FormData),
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      5,
      "/admin/website-content/media-assets/asset-1/archive",
    );

    const uploadedBody = vi.mocked(apiClient.post).mock.calls[3]?.[1] as FormData;

    expect(uploadedBody.get("file")).toBe(file);
  });

  it("keeps website content query identities scoped to content and revision-sensitive history", () => {
    expect(websiteContentQueryKeys.overview()).toEqual(["website-content", "overview"]);
    expect(websiteContentQueryKeys.draft(contentKey)).toEqual(["website-content", "home", "draft"]);
    expect(websiteContentQueryKeys.historyVersion(contentKey, "history-1")).toEqual([
      "website-content",
      "home",
      "history",
      "history-1",
    ]);
  });
});
