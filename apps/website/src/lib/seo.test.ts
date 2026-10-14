import { describe, expect, it } from "vitest";
import { createRobotsText, createSitemapXml, loadPublishedSitemapPaths } from "./seo";

describe("Website SEO documents", () => {
  it("keeps reading articles discoverable with or without the article service", async () => {
    const editorialPaths = [
      "/articles/morning-rhythm",
      "/articles/before-leaving-note",
      "/articles/after-the-walk",
    ];
    const unavailable = await loadPublishedSitemapPaths({
      getArticles: async () => {
        throw new Error("unavailable");
      },
    });

    expect(unavailable).toEqual(expect.arrayContaining(editorialPaths));
    const published = await loadPublishedSitemapPaths({
      getArticles: async () => ({
        list: [{ slug: "morning-rhythm" }, { slug: "published-care" }],
        total: 2,
        pageSize: 100,
      }),
    });

    expect(published).toEqual(
      expect.arrayContaining([...editorialPaths, "/articles/published-care"]),
    );
    expect(published.filter((path) => path === editorialPaths[0])).toHaveLength(1);
  });

  it("publishes only canonical public URLs and XML-escapes dynamic values", () => {
    expect(createSitemapXml("https://www.petcare.example", ["/", "/articles/pet&care"])).toContain(
      "<loc>https://www.petcare.example/articles/pet&amp;care</loc>",
    );
  });

  it("keeps preview routes out of crawler discovery and points robots to the canonical sitemap", () => {
    expect(createRobotsText("https://www.petcare.example")).toBe(
      "User-agent: *\nDisallow: /preview\nSitemap: https://www.petcare.example/sitemap.xml\n",
    );
  });
});
