import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

const list = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");
const detail = readFileSync(
  resolve(import.meta.dirname, "../../pages-content/community/article.vue"),
  "utf8",
);

function createDetail(profileComplete: boolean) {
  let revision = 1;
  const session = {
    user: { id: "viewer", profileComplete },
  };
  const apis = {
    createCommunityPostComment: vi.fn(),
    deleteCommunityPostComment: vi.fn(),
    getCommunityPost: vi.fn(),
    getCommunityPostComments: vi.fn().mockResolvedValue({
      list: [],
      page: 1,
      pageSize: 20,
      total: 0,
    }),
    getCommunityPostLikeState: vi.fn().mockResolvedValue({ liked: false, likesCount: 2 }),
    getMyCommunityPostComments: vi.fn().mockResolvedValue({
      list: [],
      page: 1,
      pageSize: 20,
      total: 0,
    }),
    likeCommunityPost: vi.fn(),
    reportCommunityPost: vi.fn(),
    unlikeCommunityPost: vi.fn(),
  };
  const script = detail.match(/<script setup lang="ts">([\s\S]*?)<\/script>/u)![1];
  const compiled = transpileModule(script, {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const page = runInNewContext(
    `${compiled}\n({loadComments, loadLikeState, likeButtonLabel, post, postId, commentsStatus, commentError, likeError, likeStateStatus});`,
    {
      exports: {},
      require: (name: string) => {
        if (name === "@dcloudio/uni-app") {
          return {
            onLoad: () => undefined,
            onShareAppMessage: () => undefined,
            onShareTimeline: () => undefined,
            onShow: () => undefined,
          };
        }

        if (name === "vue") {
          return { computed, ref };
        }

        if (name === "@/api/content") {
          return apis;
        }

        if (name === "@/api/request") {
          return {
            getSafeRequestErrorMessage: (_error: unknown, fallback: string) => fallback,
            MiniappApiError: class extends Error {},
          };
        }

        if (name === "@/state/session") {
          return {
            captureSessionUserRevision: () => ({ revision, userId: session.user?.id ?? null }),
            isSessionUserRevisionCurrent: (startedAt: {
              revision: number;
              userId: string | null;
            }) =>
              startedAt.revision === revision &&
              startedAt.userId !== null &&
              session.user?.id === startedAt.userId,
            requireProfile: vi.fn().mockResolvedValue(true),
            session,
          };
        }

        if (name === "@petcare/shared-types") {
          return {
            COMMUNITY_POST_REPORT_REASON: { SPAM: "spam" },
            COMMUNITY_POST_REPORT_REASON_LABELS: { spam: "垃圾信息" },
          };
        }

        if (name === "@/state/default-avatar") {
          return { getDefaultAvatar: () => "" };
        }

        return {};
      },
      uni: {},
      onLoad: () => undefined,
      onShareAppMessage: () => undefined,
      onShareTimeline: () => undefined,
      onShow: () => undefined,
    },
  ) as {
    loadComments: (reset: boolean) => Promise<void>;
    loadLikeState: () => Promise<boolean>;
    likeButtonLabel: () => string;
    post: { value: { likesCount: number } | null };
    postId: { value: string };
    commentsStatus: { value: string };
    commentError: { value: string };
    likeError: { value: string };
    likeStateStatus: { value: string };
  };

  page.postId.value = "post-id";
  page.post.value = { likesCount: 2 };

  return { page, apis, session, changeRevision: () => (revision += 1) };
}

describe("community post reader", () => {
  it("loads, refreshes, pages, retries, and opens only API-backed posts", () => {
    expect(list).toContain("getCommunityPosts({");
    expect(list).toContain("pageSize: COMMUNITY_PAGE_SIZE");
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
    expect(detail).toContain("getCommunityPostComments(postId.value, query)");
    expect(detail).toContain("getMyCommunityPostComments(postId.value, query)");
    expect(detail).toContain("createCommunityPostComment(postId.value");
    expect(detail).toContain("deleteCommunityPostComment(postId.value, comment.id)");
    expect(detail).toContain('commentsStatus.value = "loading"');
    expect(detail).toContain("commentsStatus === 'error'");
    expect(detail).toContain("comments.length === 0");
    expect(detail).toContain(':maxlength="200"');
    expect(detail).toContain(':disabled="!commentSubmittable"');
    expect(detail).toContain('v-if="comment.canDelete"');
    expect(detail).toContain(':aria-pressed="liked"');
    expect(detail).toContain("likeStateStatus === 'loading'");
    expect(detail).toContain("COMMUNITY_POST_REPORT_REASON_LABELS");
    expect(detail).toContain("requireProfile(returnUrl)");
    expect(detail).toContain(':disabled="reportSubmitting"');
    expect(detail).toContain(':aria-disabled="reportSubmitting"');
    expect(detail).toContain("动态不存在或暂不可见");
    expect(detail).toContain("社区动态加载失败");
    expect(detail).not.toContain("postActions");
    expect(detail).not.toContain("286 赞");
  });

  it("reads public comments and skips private like state until profile completion", async () => {
    const { page, apis } = createDetail(false);

    await page.loadComments(true);
    await expect(page.loadLikeState()).resolves.toBe(false);

    expect(apis.getCommunityPostComments).toHaveBeenCalledWith("post-id", {
      page: 1,
      pageSize: 20,
    });
    expect(apis.getMyCommunityPostComments).not.toHaveBeenCalled();
    expect(apis.getCommunityPostLikeState).not.toHaveBeenCalled();
    expect(page.commentsStatus.value).toBe("ready");
    expect(page.commentError.value).toBe("");
    expect(page.likeError.value).toBe("");
    expect(page.likeButtonLabel()).toBe("点赞");
  });

  it("reads owner comments and like state for a profile-complete viewer", async () => {
    const { page, apis } = createDetail(true);

    await page.loadComments(true);
    await expect(page.loadLikeState()).resolves.toBe(true);

    expect(apis.getMyCommunityPostComments).toHaveBeenCalledWith("post-id", {
      page: 1,
      pageSize: 20,
    });
    expect(apis.getCommunityPostComments).not.toHaveBeenCalled();
    expect(apis.getCommunityPostLikeState).toHaveBeenCalledWith("post-id");
    expect(page.commentsStatus.value).toBe("ready");
    expect(page.likeStateStatus.value).toBe("ready");
  });
});
