import {
  CLASSROOM_ARTICLE_CATEGORY,
  type AdminClassroomArticleDetail,
  type AdminClassroomArticleStateRequest,
  type CreateAdminClassroomArticleRequest,
  type UpdateAdminClassroomArticleRequest,
  type UploadAdminClassroomArticleMediaResponse,
} from "@petcare/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../auth";
import {
  articleQueryKeys,
  createAdminClassroomArticle,
  fetchAdminClassroomArticle,
  fetchAdminClassroomArticles,
  offlineAdminClassroomArticle,
  publishAdminClassroomArticle,
  updateAdminClassroomArticle,
  uploadAdminClassroomArticleMedia,
} from "./articles";
import {
  approveAdminContentPost,
  fetchAdminContentPost,
  fetchAdminContentPostComments,
  fetchAdminContentPostReports,
  fetchAdminContentPosts,
  offlineAdminContentPost,
  offlineAdminContentPostComment,
  postQueryKeys,
  rejectAdminContentPost,
} from "./posts";
import { fetchAdminContentRewards } from "./rewards";

vi.mock("../auth", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const articleDetail: AdminClassroomArticleDetail = {
  id: "article-1",
  category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
  title: "幼犬喂养课堂",
  summary: "基础知识",
  coverUrl: null,
  publicUrl: "https://petcare-home.com/articles/article-1",
  bodyHtml: "<p>正文</p>",
  status: "draft",
  author: null,
  publishedAt: null,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

const createRequest: CreateAdminClassroomArticleRequest = {
  category: CLASSROOM_ARTICLE_CATEGORY.FEEDING_GUIDE,
  title: articleDetail.title,
  summary: articleDetail.summary,
  bodyHtml: articleDetail.bodyHtml,
};

const updateRequest: UpdateAdminClassroomArticleRequest = {
  ...createRequest,
  expectedUpdatedAt: articleDetail.updatedAt,
};

const stateRequest: AdminClassroomArticleStateRequest = {
  expectedUpdatedAt: articleDetail.updatedAt,
};

const publicAsset: UploadAdminClassroomArticleMediaResponse = {
  id: "asset-1",
  url: "https://cdn/care.png",
  width: 800,
  height: 600,
  mimeType: "image/png",
};

describe("content api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the rewards endpoint with shared query types", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
    const query = { page: 1, pageSize: 20, status: "pending_confirm" as const };

    await expect(fetchAdminContentRewards(query)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(apiClient.get).toHaveBeenCalledWith("/admin/content/rewards", { params: query });
  });

  it("calls post and article endpoints", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });

    await fetchAdminContentPosts({ page: 1, pageSize: 20, status: "published" });
    await fetchAdminClassroomArticles({ page: 1, pageSize: 20, status: "draft" });

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/content/posts", {
      params: { page: 1, pageSize: 20, status: "published" },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/content/articles", {
      params: { page: 1, pageSize: 20, status: "draft" },
    });
  });

  it("calls every community post detail and moderation endpoint", async () => {
    const detail = {
      id: "post-1",
      status: "pending",
      updatedAt: "2026-08-26T08:00:00.000Z",
    };
    const state = { expectedUpdatedAt: detail.updatedAt };
    const reports = { list: [], total: 0 };
    const comments = { list: [], total: 0, page: 1, pageSize: 50 };
    const comment = { id: "comment-1", status: "offline" };

    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: detail } as never)
      .mockResolvedValueOnce({ data: reports } as never)
      .mockResolvedValueOnce({ data: comments } as never);
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: detail } as never)
      .mockResolvedValueOnce({ data: detail } as never)
      .mockResolvedValueOnce({ data: detail } as never)
      .mockResolvedValueOnce({ data: comment } as never);

    await expect(fetchAdminContentPost("post-1")).resolves.toBe(detail);
    await expect(fetchAdminContentPostReports("post-1")).resolves.toBe(reports);
    await expect(fetchAdminContentPostComments("post-1")).resolves.toBe(comments);
    await expect(approveAdminContentPost("post-1", state)).resolves.toBe(detail);
    await expect(
      rejectAdminContentPost("post-1", { ...state, reason: "包含联系方式" }),
    ).resolves.toBe(detail);
    await expect(
      offlineAdminContentPost("post-1", { ...state, reason: "违反社区规范" }),
    ).resolves.toBe(detail);
    await expect(
      offlineAdminContentPostComment("post-1", "comment-1", { reason: "违规" }),
    ).resolves.toBe(comment);

    expect(postQueryKeys.detail("post-1")).toEqual(["admin-content-posts", "detail", "post-1"]);
    expect(postQueryKeys.reports("post-1")).toEqual(["admin-content-posts", "reports", "post-1"]);
    expect(postQueryKeys.comments("post-1")).toEqual(["admin-content-posts", "comments", "post-1"]);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/admin/content/posts/post-1");
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/admin/content/posts/post-1/reports");
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/admin/content/posts/post-1/comments", {
      params: { page: 1, pageSize: 50 },
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/admin/content/posts/post-1/approve", state);
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/admin/content/posts/post-1/reject", {
      ...state,
      reason: "包含联系方式",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(3, "/admin/content/posts/post-1/offline", {
      ...state,
      reason: "违反社区规范",
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      4,
      "/admin/content/posts/post-1/comments/comment-1/offline",
      { reason: "违规" },
    );
  });

  it("calls every classroom article management endpoint", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: articleDetail } as never);
    vi.mocked(apiClient.post).mockResolvedValue({ data: articleDetail } as never);
    vi.mocked(apiClient.put).mockResolvedValue({ data: articleDetail } as never);

    await expect(fetchAdminClassroomArticle("article-1")).resolves.toBe(articleDetail);
    await expect(createAdminClassroomArticle(createRequest)).resolves.toBe(articleDetail);
    await expect(updateAdminClassroomArticle("article-1", updateRequest)).resolves.toBe(
      articleDetail,
    );
    await expect(publishAdminClassroomArticle("article-1", stateRequest)).resolves.toBe(
      articleDetail,
    );
    await expect(offlineAdminClassroomArticle("article-1", stateRequest)).resolves.toBe(
      articleDetail,
    );

    expect(articleQueryKeys.all).toEqual(["admin-content-articles"]);
    expect(articleQueryKeys.detail("article-1")).toEqual([
      "admin-content-articles",
      "detail",
      "article-1",
    ]);
    expect(apiClient.get).toHaveBeenCalledWith("/admin/content/articles/article-1");
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/admin/content/articles", createRequest);
    expect(apiClient.put).toHaveBeenCalledWith("/admin/content/articles/article-1", updateRequest);
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/admin/content/articles/article-1/publish",
      stateRequest,
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      3,
      "/admin/content/articles/article-1/offline",
      stateRequest,
    );
  });

  it("uploads article media in the fixed multipart field", async () => {
    const file = new File(["png"], "care.png", { type: "image/png" });

    vi.mocked(apiClient.post).mockResolvedValue({ data: publicAsset } as never);

    await expect(uploadAdminClassroomArticleMedia(file)).resolves.toBe(publicAsset);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/admin/content/articles/media-assets",
      expect.any(FormData),
    );
    const body = vi.mocked(apiClient.post).mock.calls[0]?.[1] as FormData;

    expect(body.get("file")).toBe(file);
  });
});
