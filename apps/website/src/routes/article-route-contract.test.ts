import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const articleListPath = new URL("../pages/articles/index.astro", import.meta.url);
const articleDetailPath = new URL("../pages/articles/[slug].astro", import.meta.url);
const robotsPath = new URL("../pages/robots.txt.ts", import.meta.url);
const sitemapPath = new URL("../pages/sitemap.xml.ts", import.meta.url);
const healthPath = new URL("../pages/healthz.ts", import.meta.url);
const unavailablePath = new URL("../pages/503.astro", import.meta.url);

describe("public article and operational route contracts", () => {
  it("renders article text semantically without trusted HTML insertion", async () => {
    const [listSource, detailSource] = await Promise.all([
      readFile(articleListPath, "utf8"),
      readFile(articleDetailPath, "utf8"),
    ]);

    expect(listSource).toContain("getArticles");
    expect(detailSource).toContain("getArticle");
    expect(detailSource).toContain("<article");
    expect(detailSource).toContain("<time");
    expect(`${listSource}\n${detailSource}`).not.toContain("set:html");
  });

  it("keeps sitemap dynamic, blocks preview crawling, and exposes a configuration-free health response", async () => {
    const [robotsSource, sitemapSource, healthSource] = await Promise.all([
      readFile(robotsPath, "utf8"),
      readFile(sitemapPath, "utf8"),
      readFile(healthPath, "utf8"),
    ]);

    expect(robotsSource).toContain("createRobotsText");
    expect(sitemapSource).toContain("export const prerender = false");
    expect(sitemapSource).toContain("loadPublishedSitemapPaths");
    expect(healthSource).toContain("status: \"ok\"");
    expect(healthSource).not.toContain("getWebsiteRuntimeConfig");
  });

  it("uses a dedicated noindex unavailable state instead of a draft fallback", async () => {
    const source = await readFile(unavailablePath, "utf8");

    expect(source).toContain("name=\"robots\" content=\"noindex\"");
    expect(source).not.toContain("getPreview");
    expect(source).not.toContain("getDraft");
  });
});
