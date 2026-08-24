import { describe, expect, it } from "vitest";
import {
  ADMIN_CLASSROOM_ARTICLE_STATUS,
  ADMIN_CONTENT_POST_STATUS,
  type AdminClassroomArticleDetail,
  type AdminClassroomArticleListResponse,
  type AdminClassroomArticleStateRequest,
  type AdminContentPostListResponse,
  type AdminContentRewardListResponse,
  type CreateAdminClassroomArticleRequest,
  type PublicClassroomArticleDetail,
  type PublicClassroomArticleListResponse,
  type UpdateAdminClassroomArticleRequest,
  type UploadAdminClassroomArticleMediaResponse,
} from "./content";

describe("content contracts", () => {
  it("exposes stable status values and unified pagination shapes", () => {
    expect(Object.values(ADMIN_CONTENT_POST_STATUS)).toEqual(["published", "draft", "deleted"]);
    expect(Object.values(ADMIN_CLASSROOM_ARTICLE_STATUS)).toEqual([
      "draft",
      "published",
      "offline",
    ]);

    const responses: Array<
      | AdminContentRewardListResponse
      | AdminContentPostListResponse
      | AdminClassroomArticleListResponse
    > = [];

    expect(responses).toEqual([]);
  });

  it("keeps official website article contracts limited to public fields", () => {
    const list: PublicClassroomArticleListResponse = {
      list: [
        {
          slug: "article-id",
          title: "Article title",
          summary: "Article summary",
          coverUrl: null,
          author: { displayName: "Author", avatar: null },
          publishedAt: "2026-08-01T09:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    };
    const detail: PublicClassroomArticleDetail = {
      ...list.list[0],
      bodyHtml: "<p>Plain text</p>",
    };

    expect(detail.slug).toBe("article-id");
    expect("category" in detail).toBe(false);
    expect("status" in detail).toBe(false);
  });

  it("defines editable classroom article requests and safe public HTML", () => {
    const detail: AdminClassroomArticleDetail = {
      id: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      coverUrl: null,
      status: "draft",
      author: null,
      publishedAt: null,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
      publicUrl: "https://petcare-home.com/articles/article-1",
      bodyHtml: "<p>正文</p>",
    };
    const create: CreateAdminClassroomArticleRequest = {
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      bodyHtml: "<p>正文</p>",
      coverAssetId: null,
    };
    const update: UpdateAdminClassroomArticleRequest = {
      ...create,
      expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
    };
    const state: AdminClassroomArticleStateRequest = {
      expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
    };
    const publicDetail: PublicClassroomArticleDetail = {
      slug: "article-1",
      title: "幼犬喂养课堂",
      summary: "基础喂养知识",
      coverUrl: null,
      author: null,
      publishedAt: "2026-08-24T00:00:00.000Z",
      bodyHtml: "<p>正文</p>",
    };
    const media: UploadAdminClassroomArticleMediaResponse = {
      id: "media-1",
      url: "https://petcare-home.com/media/media-1.webp",
      width: 640,
      height: 480,
      mimeType: "image/webp",
    };

    expect({ detail, update, state, publicDetail, create, media }).toBeDefined();
  });
});
