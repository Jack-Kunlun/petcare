import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const list = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");
const detail = readFileSync(
  resolve(import.meta.dirname, "../../pages-content/community/article.vue"),
  "utf8",
);

describe("community post reader", () => {
  it("loads, refreshes, pages, retries, and opens only API-backed posts", () => {
    expect(list).toContain("getCommunityPosts({ page, pageSize: COMMUNITY_PAGE_SIZE })");
    expect(list).toContain("featuredPage.value + 1");
    expect(list).toContain("featuredLoadMoreError");
    expect(list).toContain("featuredPosts.length === 0");
    expect(list).toContain('@click="loadFeatured()"');
    expect(list).toContain("openCommunityArticle(post.id)");
    expect(list).toContain("post.likesCount");
    expect(list).toContain("post.commentsCount");
    expect(list).not.toContain('id: "post-1"');
    expect(list).not.toContain("community-like.svg");
  });

  it("renders real detail data and no fake engagement content", () => {
    expect(detail).toContain("getCommunityPost(postId.value)");
    expect(detail).toContain("post.author.displayName");
    expect(detail).toContain("post.mediaUrls");
    expect(detail).toContain("reportCommunityPost(postId.value");
    expect(detail).toContain("getCommunityPostLikeState(postId.value)");
    expect(detail).toContain("likeCommunityPost(postId.value)");
    expect(detail).toContain("unlikeCommunityPost(postId.value)");
    expect(detail).toContain(':aria-pressed="liked"');
    expect(detail).toContain("likeStateStatus === 'loading'");
    expect(detail).toContain("COMMUNITY_POST_REPORT_REASON_LABELS");
    expect(detail).toContain("requireProfile(returnUrl)");
    expect(detail).toContain(':disabled="reportSubmitting"');
    expect(detail).toContain(':aria-disabled="reportSubmitting"');
    expect(detail).toContain("动态不存在、未公开或加载失败");
    expect(detail).not.toContain("const comments");
    expect(detail).not.toContain("postActions");
    expect(detail).not.toContain("286 赞");
  });
});
