import { describe, expect, it } from "vitest";
import { createRobotsText, createSitemapXml } from "./seo";

describe("Website SEO documents", () => {
  it("publishes only canonical public URLs and XML-escapes dynamic values", () => {
    expect(
      createSitemapXml("https://www.petcare.example", ["/", "/articles/pet&care"]),
    ).toContain("<loc>https://www.petcare.example/articles/pet&amp;care</loc>");
  });

  it("keeps preview routes out of crawler discovery and points robots to the canonical sitemap", () => {
    expect(createRobotsText("https://www.petcare.example")).toBe(
      "User-agent: *\nDisallow: /preview\nSitemap: https://www.petcare.example/sitemap.xml\n",
    );
  });
});
