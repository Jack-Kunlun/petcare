import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sub page layout background contract", () => {
  it("keeps the status placeholder, navigation, and page on the same default background", () => {
    const source = readFileSync(new URL("./SubPageLayout.vue", import.meta.url), "utf8");

    expect(source).toContain('class="shrink-0 bg-page-bg"');
    expect(source).toContain("bg-page-bg");
    expect(source).not.toContain("border-b border-divider bg-surface");
  });
});
