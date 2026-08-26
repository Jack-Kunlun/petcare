import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const article = readFileSync(resolve(import.meta.dirname, "article.vue"), "utf8");

describe("published classroom article page", () => {
  it("loads the route article and renders mutually exclusive request states", () => {
    expect(article).toContain("getClassroomArticle(articleSlug.value)");
    expect(article).toContain("error instanceof MiniappApiError && error.statusCode === 404");
    expect(article).toContain("v-if=\"status === 'loading'\"");
    expect(article).toContain("v-else-if=\"status === 'unavailable'\"");
    expect(article).toContain("v-else-if=\"status === 'error'\"");
    expect(article).toContain(':disabled="loading"');
    expect(article).toContain(':aria-disabled="loading"');
    expect(article).toContain('@click="load"');
  });

  it("renders only server-provided article content", () => {
    expect(article).toContain(':src="article.coverUrl"');
    expect(article).toContain("{{ article.title }}");
    expect(article).toContain("{{ article.summary }}");
    expect(article).toContain(':nodes="article.bodyHtml"');
    expect(article).not.toContain("const sections");
    expect(article).not.toContain("const checklist");
    expect(article).not.toContain("const related");
    expect(article).not.toContain("community-pet-4.jpg");
    expect(article).not.toContain("v-html");
  });
});
