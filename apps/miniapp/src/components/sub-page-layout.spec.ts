import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sub page navigation contract", () => {
  it("uses one white top surface above the neutral page", () => {
    const source = readFileSync(new URL("./SubPageLayout.vue", import.meta.url), "utf8");

    expect(source).toContain('class="shrink-0 bg-surface"');
    expect(source).toContain('class="relative flex shrink-0 items-center bg-surface"');
    expect(source).toContain("bg-page-bg");
  });

  it("keeps a 44px hit area while aligning the back icon to the navigation baseline", () => {
    const source = readFileSync(new URL("./SubPageLayout.vue", import.meta.url), "utf8");

    expect(source).toContain("left-0");
    expect(source).toContain("h-control w-control");
    expect(source).toContain("justify-start");
    expect(source).toContain("pl-navigation-horizontal");
    expect(source).not.toMatch(/:style="\{ left: `\$\{navigationHorizontalGap\}px` \}"/);
  });

  it("centers titles when space permits and reserves title width on narrow screens", () => {
    const source = readFileSync(new URL("./SubPageLayout.vue", import.meta.url), "utf8");

    expect(source).toMatch(/left: `\$\{titleLeftInset\}px`, right: `\$\{titleInset\}px`/);
    expect(source).toContain("layout.value.windowWidth - titleInset.value * 2");
  });
});
