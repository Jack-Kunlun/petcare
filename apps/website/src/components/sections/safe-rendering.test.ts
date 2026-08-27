import { describe, expect, it } from "vitest";
import { getPublicImage, getSafeWebsiteHref } from "./safe-rendering";

describe("safe Website section rendering values", () => {
  it("keeps only the persisted link protocols and fails closed for a malformed value", () => {
    expect(getSafeWebsiteHref("/contact")).toBe("/contact");
    expect(getSafeWebsiteHref("https://www.petcare.example/contact")).toBe(
      "https://www.petcare.example/contact",
    );
    expect(getSafeWebsiteHref("javascript:alert(1)")).toBeNull();
    expect(getSafeWebsiteHref("//untrusted.example")).toBeNull();
  });

  it("uses a dimensioned approved fallback when public media is absent or malformed", () => {
    expect(getPublicImage(null, "hero")).toEqual({
      src: "/brand/hero-community-companion-desktop-v1.webp",
      width: 1920,
      height: 720,
    });
    expect(
      getPublicImage({ url: "javascript:alert(1)", width: 1, height: 1 }, "placeholder"),
    ).toEqual({
      src: "/brand/petcare-placeholder-light.svg",
      width: 1600,
      height: 900,
    });
    expect(getPublicImage(null, "communityCompanion")).toEqual({
      src: "/brand/hero-community-companion-desktop-v1.webp",
      width: 1920,
      height: 720,
    });
  });
});
