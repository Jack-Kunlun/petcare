import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("community publisher", () => {
  it("keeps submission and moderation states visible and behaviorally disabled", () => {
    const source = readFileSync(resolve(import.meta.dirname, "publish.vue"), "utf8");

    expect(source).toContain("createCommunityPost");
    expect(source).toContain("getMyCommunityPosts");
    expect(source).toContain(':disabled="!canSubmit"');
    expect(source).toContain(':aria-disabled="!canSubmit"');
    expect(source).toContain(':disabled="submitting"');
    expect(source).toContain("未通过原因");
  });
});
