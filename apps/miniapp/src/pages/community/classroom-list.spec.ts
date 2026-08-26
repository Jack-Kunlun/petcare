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

  it("keeps list states and unavailable controls behaviorally explicit", () => {
    expect(community).toContain("classroomStatus === 'loading'");
    expect(community).toContain("classroomStatus === 'error'");
    expect(community).toContain("classroomArticles.length === 0");
    expect(community).toContain("classroomLoadMoreError");
    expect(community).toContain(':disabled="classroomLoading"');
    expect(community).toContain(':aria-disabled="classroomLoading"');
    expect(community).toContain('{ value: "nearby", label: "附近动态", disabled: true }');
  });
});
