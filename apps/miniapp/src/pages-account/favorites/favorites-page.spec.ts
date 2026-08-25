import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("favorites category tabs", () => {
  it("uses lightweight accessible text tabs with a compact active indicator", () => {
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain(':aria-selected="activeTab === tab"');
    expect(source).toContain('@click="activeTab = tab"');
    expect(source).toContain('class="h-control flex"');
    expect(source).toContain("text-brand-active font-semibold");
    expect(source).toContain("h-tab-indicator w-indicator rounded-pill bg-brand");
    expect(source).not.toContain("h-control flex rounded-pill bg-surface p-caption shadow-card");
    expect(source).not.toContain("index === 0 ? 'bg-brand' : ''");
  });

  it("keeps one action gap before rendering the selected category list", () => {
    expect(source).toContain('class="mt-action flex flex-col gap-copy"');
    expect(source).toContain('v-for="item in visibleItems"');
  });
});
