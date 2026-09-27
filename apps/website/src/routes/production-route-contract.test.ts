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

  it("does not publish paused commercial landing pages", async () => {
    const pageEntries = await readdir(path.join(websiteDirectory, "src/pages"), {
      recursive: true,
    });

    expect(pageEntries).not.toContain("services.astro");
    expect(pageEntries).not.toContain("trust.astro");
    expect(pageEntries).not.toContain("companions.astro");
  });

  it("keeps homepage fallbacks within the current personal-version scope", async () => {
    const sources = await Promise.all(
      [
        "src/components/HomeExperience.astro",
        "src/components/sections/HeroSection.astro",
        "src/components/sections/safe-rendering.ts",
      ].map((relativePath) => readFile(path.join(websiteDirectory, relativePath), "utf8")),
    );

    expect(sources.join("\n")).not.toMatch(
      /\/services|\/trust|\/companions|悬赏|宠托师|服务进行中|身份认证|优惠券|订单/,
    );
  });

  it("renders the homepage from code-owned marketing content", async () => {
    const [homepage, staticHome] = await Promise.all([
      readFile(path.join(websiteDirectory, "src/pages/index.astro"), "utf8"),
      readFile(path.join(websiteDirectory, "src/components/StaticHome.astro"), "utf8"),
    ]);

    expect(homepage).toContain("StaticHome");
    expect(homepage).not.toContain("PublishedPage");
    expect(staticHome).toContain("让每一份牵挂");
    expect(staticHome).toContain("/brand/hero-community-companion-desktop-v1.webp");
  });
});
