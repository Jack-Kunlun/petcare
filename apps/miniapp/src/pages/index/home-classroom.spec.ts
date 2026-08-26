import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("home classroom section", () => {
  it("renders the latest published articles and routes to real list and detail pages", () => {
    expect(home).toContain("getClassroomArticles({ page: 1, pageSize: HOME_CLASSROOM_PAGE_SIZE })");
    expect(home).toContain('url: "/pages/community/index?tab=classroom"');
    expect(home).toContain("openClassroomArticle(article.slug)");
    expect(home).toContain("article.coverUrl || CLASSROOM_COVER_PLACEHOLDER");
    expect(home).toContain("/static/main/petcare-placeholder-light.svg");
    expect(home).toContain("article.publishedAt");
    expect(home).toContain("发布于 {{ publishedDate(article.publishedAt) }}");
    expect(home).not.toContain("2.4k 阅读");
    expect(home).not.toContain("1.8k 阅读");
  });

  it("keeps loading, empty, and retryable failure states local to the section", () => {
    expect(home).toContain("classroomStatus === 'loading'");
    expect(home).toContain("classroomStatus === 'error'");
    expect(home).toContain("classroomArticles.length === 0");
    expect(home).toContain("classroomArticles.value = []");
    expect(home).toContain('aria-label="查看全部课堂文章"');
    expect(home).toContain(':disabled="classroomLoading"');
    expect(home).toContain(':aria-disabled="classroomLoading"');
  });
});
