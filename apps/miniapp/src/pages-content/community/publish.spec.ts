import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("community publisher", () => {
  it("keeps submission and moderation states visible and behaviorally disabled", () => {
    const source = readFileSync(resolve(import.meta.dirname, "publish.vue"), "utf8");

    expect(source).toContain("createCommunityPost");
    expect(source).toContain("getMyCommunityPosts");
    expect(source).toContain("deleteCommunityPost");
    expect(source).toContain("uploadCommunityMedia");
    expect(source).toContain("discardCommunityMedia");
    expect(source).toContain("uni.chooseImage");
    expect(source).toContain("item.progress = progress");
    expect(source).toContain("mediaAssetIds:");
    expect(source).toContain('@click="uploadMedia(item)"');
    expect(source).toContain('@click="removeMedia(item)"');
    expect(source).toContain('@click="deletePost(post)"');
    expect(source).toContain(':disabled="!canSubmit"');
    expect(source).toContain(':loading="submitting"');
    expect(source).toContain("PcButton");
    expect(source).toContain("PcStatePanel");
    expect(source).toContain(':disabled="submitting"');
    expect(source).toContain("未通过原因");
    expect(source).toContain("删除失败，动态仍保留，请重试");
  });
});
