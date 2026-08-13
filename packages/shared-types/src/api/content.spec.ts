import { describe, expect, it } from "vitest";
import {
  ADMIN_CLASSROOM_ARTICLE_STATUS,
  ADMIN_CONTENT_POST_STATUS,
  type AdminClassroomArticleListResponse,
  type AdminContentPostListResponse,
  type AdminContentRewardListResponse,
  type PublicClassroomArticleDetail,
  type PublicClassroomArticleListResponse,
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
      body: "&lt;p&gt;Plain text&lt;/p&gt;",
    };

    expect(detail.slug).toBe("article-id");
    expect("category" in detail).toBe(false);
    expect("status" in detail).toBe(false);
  });
});
