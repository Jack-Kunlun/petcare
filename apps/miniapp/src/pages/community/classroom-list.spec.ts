import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const community = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("community classroom list", () => {
  it("loads published articles with category, search, paging, and route filters", () => {
    expect(community).toContain("getClassroomArticles({");
    expect(community).toContain("keyword: keyword || undefined");
    expect(community).toContain("classroomAppliedKeyword.value");
    expect(community).toContain("category: classroomCategory.value ?? undefined");
    expect(community).toContain("classroomPage.value + 1");
    expect(community).toContain('query.tab === "classroom"');
    expect(community).toContain("openClassroomArticle(article.slug)");
  });

  it("keeps list states explicit without advertising unavailable channels", () => {
    expect(community).toContain("classroomStatus === 'loading'");
    expect(community).toContain("classroomStatus === 'error'");
    expect(community).toContain("classroomArticles.length === 0");
    expect(community).toContain("classroomLoadMoreError");
    expect(community).toContain(':disabled="classroomLoading"');
    expect(community).toContain(':aria-disabled="classroomLoading"');
    expect(community).not.toContain("附近动态");
    expect(community).not.toContain("tab.disabled");
  });
});

describe("community featured list", () => {
  it("loads published posts with search, content type, paging, and explicit states", () => {
    expect(community).toContain("getCommunityPosts({");
    expect(community).toContain("keyword: keyword || undefined");
    expect(community).toContain("featuredAppliedKeyword.value");
    expect(community).toContain("contentType: featuredContentType.value ?? undefined");
    expect(community).toContain("featuredPage.value + 1");
    expect(community).toContain("featuredStatus === 'loading'");
    expect(community).toContain("featuredStatus === 'error'");
    expect(community).toContain("featuredPosts.length === 0");
    expect(community).toContain("featuredLoadMoreError");
  });

  it("keeps search and filters unavailable while the feed is loading", () => {
    expect(community).toContain('aria-label="搜索社区动态"');
    expect(community).toContain(':maxlength="50"');
    expect(community).toContain("selectFeaturedContentType(option.value)");
    expect(community).toContain(':aria-disabled="featuredLoading"');
    expect(community).toContain(":hover-class=\"featuredLoading ? 'none' : 'opacity-80'\"");
  });

  it("does not advertise follow or share placeholders", () => {
    expect(community).not.toContain("关注与分享功能暂未开放");
  });
});
