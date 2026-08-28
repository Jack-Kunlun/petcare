import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("home classroom section", () => {
  it("keeps the root header compact inside the WeChat capsule-safe area", () => {
    expect(home).toContain("PetCare 宠伴");
    expect(home).toContain("记录每一份陪伴");
    expect(home).not.toContain("记录 · 内容 · 社区");
    expect(home).not.toContain("内容 · 社区 · 档案");
  });

  it("uses the approved full-width brand hero instead of a community feed photo", () => {
    expect(home).toContain(':src="MINIAPP_TRUSTED_CARE_HERO"');
    expect(home).toContain("absolute inset-0 h-full w-full");
    expect(home).not.toContain("/static/main/community-pet-5.jpg");
  });

  it("presents only current personal features without commercial service fixtures", () => {
    expect(home).toContain("管理宠物档案");
    expect(home).toContain("管理档案，发现养宠内容");
    expect(home).not.toContain("pages-bounty");
    expect(home).not.toContain("pages-care");
    expect(home).not.toContain("服务进行中");
    expect(home).not.toContain("附近热门悬赏");
    expect(home).not.toContain("¥68/次");
  });

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
    expect(home).toContain(':primary-disabled="classroomLoading"');
    expect(home).toContain('@primary="loadHomeClassroom"');
    expect(home).toContain("PcStatePanel");
  });
});
