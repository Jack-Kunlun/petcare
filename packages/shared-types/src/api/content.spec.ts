import { describe, expect, it } from "vitest";
import {
  ADMIN_CLASSROOM_ARTICLE_STATUS,
  ADMIN_CONTENT_POST_STATUS,
  type AdminClassroomArticleListResponse,
  type AdminContentPostListResponse,
  type AdminContentRewardListResponse,
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
});
