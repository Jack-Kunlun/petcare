import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentsDirectory = import.meta.dirname;
const miniappSourceDirectory = resolve(componentsDirectory, "..");

function readSource(relativePath: string) {
  return readFileSync(resolve(miniappSourceDirectory, relativePath), "utf8");
}

const rootPagePaths = [
  "pages/index/index.vue",
  "pages/bounty/index.vue",
  "pages/community/index.vue",
  "pages/messages/index.vue",
  "pages/profile/index.vue",
] as const;

describe("main tab layout root header contract", () => {
  it("renders the root header before scroll content without an empty navigation placeholder", () => {
    const source = readSource("components/MainTabLayout.vue");
    const headerSlotIndex = source.indexOf('<slot name="header"');
    const scrollViewIndex = source.indexOf("<scroll-view");

    expect(headerSlotIndex).toBeGreaterThan(-1);
    expect(headerSlotIndex).toBeLessThan(scrollViewIndex);
    expect(source).not.toContain("layout.pageTopInset");
    expect(source).toContain("capsuleReservedWidth");
  });

  it("switches custom tabs without native tab bar APIs", () => {
    const layoutSource = readSource("components/MainTabLayout.vue");
    const homeSource = readSource("pages/index/index.vue");
    const publishSuccessSource = readSource("pages-bounty/publish/success.vue");

    expect(layoutSource).toContain("uni.redirectTo");
    expect(layoutSource).not.toContain("uni.hideTabBar");
    expect(layoutSource).not.toContain("uni.switchTab");
    expect(homeSource).toContain("uni.redirectTo");
    expect(homeSource).not.toContain("uni.switchTab");
    expect(publishSuccessSource).toContain("uni.reLaunch");
    expect(publishSuccessSource).not.toContain("uni.switchTab");
  });

  it.each(rootPagePaths)("moves %s header into the shared root header slot", (pagePath) => {
    const source = readSource(pagePath);

    expect(source).toContain("<template #header>");
    expect(source).not.toMatch(/class="h-header\b/);
  });

  it("uses the semantic page gutter for the shared root header", () => {
    const source = readSource("components/MainTabLayout.vue");

    expect(source).toContain("pl-page-horizontal");
    expect(source).not.toContain("pl-action");
  });

  it.each(rootPagePaths)("uses the semantic page grid in %s", (pagePath) => {
    const source = readSource(pagePath);

    expect(source).toMatch(/\b(?:mx|px)-page-horizontal\b/);
    expect(source).not.toMatch(/\b(?:mx|px)-action\b/);
  });
});
