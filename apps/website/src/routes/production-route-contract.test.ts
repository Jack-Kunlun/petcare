import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const websiteDirectory = path.resolve(import.meta.dirname, "../..");

describe("production route manifest", () => {
  it("does not publish test files as Astro routes", async () => {
    const pageEntries = await readdir(path.join(websiteDirectory, "src/pages"), {
      recursive: true,
    });

    expect(pageEntries.filter((entry) => /\.test\.[cm]?[jt]sx?$/u.test(entry))).toEqual([]);
  });

  it("publishes the formal product landing pages", async () => {
    const pageEntries = await readdir(path.join(websiteDirectory, "src/pages"), {
      recursive: true,
    });

    expect(pageEntries).toEqual(
      expect.arrayContaining([
        "care.astro",
        "caregivers.astro",
        "start.astro",
        "product.astro",
        "for-pet-owners.astro",
        "for-providers.astro",
        "rewards.astro",
        "payments.astro",
        "trust.astro",
        "service-flow.astro",
        "help.astro",
      ]),
    );
  });

  it("keeps the formal homepage content code-owned", async () => {
    const sources = await Promise.all(
      [
        "src/components/StaticHome.astro",
        "src/components/SiteHeader.astro",
        "src/content/marketing.ts",
      ].map((relativePath) => readFile(path.join(websiteDirectory, relativePath), "utf8")),
    );

    expect(sources.join("\n")).toContain("/care");
    expect(sources.join("\n")).toContain("产品体验");
  });

  it("renders the homepage from code-owned marketing content", async () => {
    const [homepage, staticHome, carePreview] = await Promise.all([
      readFile(path.join(websiteDirectory, "src/pages/index.astro"), "utf8"),
      readFile(path.join(websiteDirectory, "src/components/StaticHome.astro"), "utf8"),
      readFile(path.join(websiteDirectory, "src/components/CarePreview.astro"), "utf8"),
    ]);

    expect(homepage).toContain("StaticHome");
    expect(homepage).not.toContain("PublishedPage");
    expect(staticHome).toContain("放心出发");
    expect(staticHome).toContain("探索产品体验");
    expect(staticHome).toContain('href="#product-experience"');
    expect(staticHome).toContain('href="#pet-profile"');
    expect(staticHome).toContain("/brand/home/hero.png");
    expect(staticHome).toContain("<CarePreview");
    expect(carePreview).toContain('role="tablist"');
    expect(carePreview).toContain('role="tabpanel"');
    expect(carePreview).toContain("回看整个流程");
    expect(staticHome).not.toContain("figma.com");
    expect(staticHome).not.toContain("home-page__pillars");
  });
});
