import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const previewIndexPath = new URL("../pages/preview/index.astro", import.meta.url);
const previewPagePath = new URL("../pages/preview/[contentKey].astro", import.meta.url);

describe("preview route contract", () => {
  it("removes the fragment token before the exchange and never stores it in browser storage", async () => {
    const source = await readFile(previewIndexPath, "utf8");

    expect(source).toContain("window.location.hash.slice(1)");
    expect(source).toContain("history.replaceState");
    expect(source).toContain("fetch(\"/preview/session\"");
    expect(source).not.toMatch(/(?:local|session)Storage/u);
  });

  it("uses only the HttpOnly cookie and no public fallback path in preview SSR", async () => {
    const source = await readFile(previewPagePath, "utf8");

    expect(source).toContain("Astro.cookies.get(WEBSITE_PREVIEW_COOKIE)");
    expect(source).toContain("loadPreviewPageContent");
    expect(source).not.toContain("loadPublishedPageContent");
    expect(source).toContain("\"Cache-Control\", \"private, no-store\"");
    expect(source).toContain("\"X-Robots-Tag\", \"noindex, nofollow\"");
  });
});
