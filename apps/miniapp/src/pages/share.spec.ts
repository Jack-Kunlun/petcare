import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

describe("wechat sharing", () => {
  it.each([
    ["home", "index/index.vue"],
    ["community", "community/index.vue"],
    ["classroom article", "../pages-content/classroom/article.vue"],
    ["community post", "../pages-content/community/article.vue"],
  ])("enables native friend and timeline sharing on the %s page", (_name, path) => {
    const source = page(path);

    expect(source).toContain("onShareAppMessage(");
    expect(source).toContain("onShareTimeline(");
  });

  it("keeps shared detail links on their public content route", () => {
    const classroom = page("../pages-content/classroom/article.vue");
    const community = page("../pages-content/community/article.vue");

    expect(classroom).toMatch(
      /\/pages-content\/classroom\/article\?id=\$\{encodeURIComponent\(articleSlug\.value\)\}/u,
    );
    expect(community).toMatch(
      /\/pages-content\/community\/article\?id=\$\{encodeURIComponent\(postId\.value\)\}/u,
    );
  });
});
