<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import {
  COMMUNITY_POST_REPORT_REASON,
  COMMUNITY_POST_REPORT_REASON_LABELS,
} from "@petcare/shared-types";
import type {
  CommunityPostLikeState,
  CommunityPostReportReason,
  PublicCommunityPostDetail,
} from "@petcare/shared-types";
import { computed, ref } from "vue";
import {
  getCommunityPost,
  getCommunityPostLikeState,
  likeCommunityPost,
  reportCommunityPost,
  unlikeCommunityPost,
} from "@/api/content";
import { MiniappApiError } from "@/api/request";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";
import { requireProfile, session } from "@/state/session";

const postId = ref("");
const post = ref<PublicCommunityPostDetail | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
const loading = ref(false);
const checkingProfile = ref(false);
const liked = ref(false);
const likeStateStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const likePending = ref(false);
const likeError = ref("");
const reportVisible = ref(false);
const reportReason = ref<CommunityPostReportReason>(COMMUNITY_POST_REPORT_REASON.SPAM);
const reportDescription = ref("");
const reportSubmitting = ref(false);
const reportError = ref("");
const reportSuccess = ref("");
const reportReasons = Object.values(COMMUNITY_POST_REPORT_REASON);
const avatar = computed(() =>
  post.value ? (post.value.author.avatar ?? getDefaultAvatar(post.value.id)) : "",
);

function formatDate(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function applyLikeState(state: CommunityPostLikeState): void {
  liked.value = state.liked;
  likeStateStatus.value = "ready";

  if (post.value) {
    post.value = { ...post.value, likesCount: state.likesCount };
  }
}

function likeButtonLabel(): string {
  if (checkingProfile.value) {
    return "正在检查账号";
  }

  if (likePending.value) {
    return "处理中";
  }

  if (likeStateStatus.value === "loading") {
    return "读取点赞状态";
  }

  if (likeStateStatus.value === "error" && session.user) {
    return "重试点赞";
  }

  return liked.value ? "取消点赞" : "点赞";
}

async function loadLikeState(): Promise<boolean> {
  if (
    !session.user ||
    !post.value ||
    !postId.value ||
    likePending.value ||
    likeStateStatus.value === "loading"
  ) {
    return false;
  }

  likeStateStatus.value = "loading";
  likeError.value = "";

  try {
    applyLikeState(await getCommunityPostLikeState(postId.value));

    return true;
  } catch (error) {
    likeStateStatus.value = "error";
    likeError.value = error instanceof MiniappApiError ? error.message : "点赞状态加载失败，请重试";

    return false;
  }
}

async function loadPost(): Promise<void> {
  if (loading.value || !postId.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";

  try {
    post.value = await getCommunityPost(postId.value);
    status.value = "ready";
    liked.value = false;
    likeStateStatus.value = "idle";
    likeError.value = "";

    if (session.user) {
      void loadLikeState();
    }
  } catch {
    post.value = null;
    status.value = "error";
  } finally {
    loading.value = false;
  }
}

async function toggleLike(): Promise<void> {
  if (
    checkingProfile.value ||
    likePending.value ||
    reportSubmitting.value ||
    !post.value ||
    !postId.value
  ) {
    return;
  }

  checkingProfile.value = true;
  const returnUrl = `/pages-content/community/article?id=${encodeURIComponent(postId.value)}`;

  try {
    if (!(await requireProfile(returnUrl))) {
      return;
    }

    if (likeStateStatus.value !== "ready" && !(await loadLikeState())) {
      return;
    }

    likePending.value = true;
    likeError.value = "";

    try {
      applyLikeState(
        await (liked.value ? unlikeCommunityPost(postId.value) : likeCommunityPost(postId.value)),
      );
    } catch (error) {
      likeError.value = error instanceof MiniappApiError ? error.message : "点赞操作失败，请重试";
    } finally {
      likePending.value = false;
    }
  } finally {
    checkingProfile.value = false;
  }
}

async function openReport(): Promise<void> {
  if (checkingProfile.value || reportSubmitting.value || !postId.value) {
    return;
  }

  checkingProfile.value = true;
  const returnUrl = `/pages-content/community/article?id=${encodeURIComponent(postId.value)}`;

  try {
    if (await requireProfile(returnUrl)) {
      reportVisible.value = true;
      reportError.value = "";
      reportSuccess.value = "";
    }
  } finally {
    checkingProfile.value = false;
  }
}

function closeReport(): void {
  if (!reportSubmitting.value) {
    reportVisible.value = false;
    reportError.value = "";
  }
}

function selectReportReason(reason: CommunityPostReportReason): void {
  if (!reportSubmitting.value) {
    reportReason.value = reason;
  }
}

async function submitReport(): Promise<void> {
  if (reportSubmitting.value || !postId.value) {
    return;
  }

  reportSubmitting.value = true;
  reportError.value = "";

  try {
    const description = reportDescription.value.trim();

    await reportCommunityPost(postId.value, {
      reason: reportReason.value,
      ...(description ? { description } : {}),
    });
    reportVisible.value = false;
    reportDescription.value = "";
    reportSuccess.value = "举报已提交，运营人员会尽快处理";
  } catch (error) {
    reportError.value =
      error instanceof MiniappApiError ? error.message : "举报提交失败，请稍后重试";
  } finally {
    reportSubmitting.value = false;
  }
}

onLoad((query = {}) => {
  if (typeof query.id !== "string" || !query.id) {
    status.value = "error";

    return;
  }

  postId.value = query.id;
  void loadPost();
});

onShow(() => {
  if (!session.user) {
    liked.value = false;
    likeStateStatus.value = "idle";

    return;
  }

  if (post.value && likeStateStatus.value === "idle") {
    void loadLikeState();
  }
});
</script>

<template>
  <SubPageLayout title="社区动态">
    <view class="px-action py-card">
      <view v-if="status === 'loading'" class="main-card p-action" aria-live="polite">
        <text class="text-body text-muted leading-body">社区动态加载中…</text>
      </view>

      <view
        v-else-if="status === 'error'"
        class="flex flex-col gap-copy rounded-card bg-danger-soft p-action"
        role="alert"
      >
        <text class="text-body text-ink leading-body">动态不存在、未公开或加载失败</text>
        <button
          class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
          :disabled="loading || !postId"
          :aria-disabled="loading || !postId"
          :loading="loading"
          @click="loadPost"
        >
          重新加载
        </button>
      </view>

      <view v-else-if="post" class="main-card p-action">
        <view class="flex items-center gap-copy">
          <image class="h-avatar w-avatar rounded-full" :src="avatar" mode="aspectFill" />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-body text-ink font-semibold leading-label">
              {{ post.author.displayName }}
            </text>
            <text class="quiet-text">{{ formatDate(post.createdAt) }}</text>
          </view>
        </view>

        <text class="mt-action block text-body text-ink leading-body">{{ post.content }}</text>
        <view v-if="post.mediaUrls.length > 0" class="grid grid-cols-2 mt-action gap-copy">
          <image
            v-for="url in post.mediaUrls"
            :key="url"
            class="h-hero-main w-full rounded-control"
            :src="url"
            mode="aspectFill"
          />
        </view>

        <view class="mt-action border-t border-divider pt-copy">
          <view class="flex items-center gap-copy">
            <button
              class="min-h-control border rounded-control px-action text-body font-medium"
              :class="[
                liked
                  ? 'border-brand bg-soft text-brand-active'
                  : 'border-divider bg-surface text-muted',
                likePending || checkingProfile || likeStateStatus === 'loading' ? 'opacity-50' : '',
              ]"
              :disabled="
                likePending || checkingProfile || reportSubmitting || likeStateStatus === 'loading'
              "
              :aria-disabled="
                likePending || checkingProfile || reportSubmitting || likeStateStatus === 'loading'
              "
              :aria-pressed="liked"
              :loading="likePending"
              @click="toggleLike"
            >
              {{ likeButtonLabel() }} · {{ post.likesCount }}
            </button>
            <text class="quiet-text">评论 {{ post.commentsCount }}</text>
          </view>
          <text v-if="likeError" class="mt-copy block text-small text-danger" role="alert">
            {{ likeError }}
          </text>
          <text class="mt-copy block quiet-text">评论、关注与分享功能暂未开放</text>
        </view>

        <view class="mt-copy border-t border-divider pt-copy">
          <text v-if="reportSuccess" class="block text-small text-success" role="status">
            {{ reportSuccess }}
          </text>
          <button
            v-if="!reportVisible"
            class="mt-copy h-control w-full border border-divider rounded-control bg-surface text-body text-muted"
            :disabled="checkingProfile || likePending || reportSubmitting"
            :aria-disabled="checkingProfile || likePending || reportSubmitting"
            @click="openReport"
          >
            {{ checkingProfile ? "正在检查账号" : "举报该动态" }}
          </button>

          <view
            v-else
            class="mt-copy flex flex-col gap-copy rounded-control bg-page-bg p-copy"
            aria-label="举报动态"
          >
            <text class="text-body text-ink font-semibold">选择举报原因</text>
            <view class="grid grid-cols-2 gap-copy">
              <button
                v-for="item in reportReasons"
                :key="item"
                class="min-h-control border rounded-control px-copy text-small"
                :class="
                  reportReason === item
                    ? 'border-brand bg-soft text-brand-active'
                    : 'border-divider bg-surface text-muted'
                "
                :disabled="reportSubmitting"
                :aria-disabled="reportSubmitting"
                :aria-pressed="reportReason === item"
                @click="selectReportReason(item)"
              >
                {{ COMMUNITY_POST_REPORT_REASON_LABELS[item] }}
              </button>
            </view>

            <textarea
              v-model="reportDescription"
              class="h-card-cover w-full border border-divider rounded-control bg-surface p-copy text-body text-ink"
              :maxlength="500"
              placeholder="补充说明（选填，最多 500 字）"
              :disabled="reportSubmitting"
              :aria-disabled="reportSubmitting"
            />
            <text class="text-right quiet-text">{{ reportDescription.length }}/500</text>
            <text v-if="reportError" class="text-small text-danger" role="alert">
              {{ reportError }}
            </text>
            <view class="grid grid-cols-2 gap-copy">
              <button
                class="h-control border border-divider rounded-control bg-surface text-body text-muted"
                :disabled="reportSubmitting"
                :aria-disabled="reportSubmitting"
                @click="closeReport"
              >
                取消
              </button>
              <button
                class="h-control rounded-control bg-brand-active text-body text-surface font-medium"
                :disabled="reportSubmitting"
                :aria-disabled="reportSubmitting"
                :loading="reportSubmitting"
                @click="submitReport"
              >
                {{ reportSubmitting ? "提交中" : "提交举报" }}
              </button>
            </view>
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
