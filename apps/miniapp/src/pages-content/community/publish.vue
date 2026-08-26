<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type { CommunityPostStatus, MyCommunityPostListItem } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { createCommunityPost, getMyCommunityPosts } from "@/api/content";
import { MiniappApiError } from "@/api/request";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { requireProfile } from "@/state/session";

const MAX_CONTENT_LENGTH = 1000;
const content = ref("");
const posts = ref<MyCommunityPostListItem[]>([]);
const total = ref(0);
const listStatus = ref<"loading" | "ready" | "error">("loading");
const listLoading = ref(false);
const submitting = ref(false);
const submitError = ref("");
const trimmedContent = computed(() => content.value.trim());
const canSubmit = computed(
  () =>
    !submitting.value &&
    trimmedContent.value.length > 0 &&
    trimmedContent.value.length <= MAX_CONTENT_LENGTH,
);

const statusLabels: Record<CommunityPostStatus, string> = {
  [ADMIN_CONTENT_POST_STATUS.PENDING]: "审核中",
  [ADMIN_CONTENT_POST_STATUS.PUBLISHED]: "已发布",
  [ADMIN_CONTENT_POST_STATUS.REJECTED]: "未通过",
  [ADMIN_CONTENT_POST_STATUS.OFFLINE]: "已下架",
  [ADMIN_CONTENT_POST_STATUS.DELETED]: "已删除",
};

const statusTones: Record<CommunityPostStatus, string> = {
  [ADMIN_CONTENT_POST_STATUS.PENDING]: "bg-warning-soft text-warning",
  [ADMIN_CONTENT_POST_STATUS.PUBLISHED]: "bg-success-soft text-success",
  [ADMIN_CONTENT_POST_STATUS.REJECTED]: "bg-danger-soft text-danger",
  [ADMIN_CONTENT_POST_STATUS.OFFLINE]: "bg-divider text-muted",
  [ADMIN_CONTENT_POST_STATUS.DELETED]: "bg-divider text-muted",
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof MiniappApiError ? error.message : fallback;
}

function formatDate(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

async function loadMine(): Promise<void> {
  if (listLoading.value) {
    return;
  }

  listLoading.value = true;
  listStatus.value = "loading";

  try {
    const response = await getMyCommunityPosts({ page: 1, pageSize: 20 });

    posts.value = response.list;
    total.value = response.total;
    listStatus.value = "ready";
  } catch {
    listStatus.value = "error";
  } finally {
    listLoading.value = false;
  }
}

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }

  submitting.value = true;
  submitError.value = "";

  try {
    const post = await createCommunityPost({ content: trimmedContent.value });

    content.value = "";
    posts.value = [post, ...posts.value];
    total.value += 1;
    listStatus.value = "ready";
    await uni.showToast({ title: "已提交审核", icon: "success" }).catch(() => undefined);
  } catch (error) {
    submitError.value = errorMessage(error, "提交失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
}

onLoad(() => {
  void requireProfile("/pages-content/community/publish").then((allowed) => {
    if (allowed) {
      void loadMine();
    }
  });
});
</script>

<template>
  <SubPageLayout title="发布动态">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="main-card p-action">
        <text class="section-heading">分享养宠生活</text>
        <text class="mt-caption block meta-text">文字动态提交后将进入审核，不会立即公开。</text>
        <textarea
          v-model="content"
          class="mt-action box-border h-hero-main w-full rounded-control bg-page-bg p-copy text-body text-ink leading-body"
          :class="submitting ? 'opacity-50' : ''"
          :disabled="submitting"
          :aria-disabled="submitting"
          :maxlength="MAX_CONTENT_LENGTH"
          aria-label="动态正文"
          placeholder="记录你和宠物今天的故事"
        />
        <text class="mt-sm block text-right quiet-text">
          {{ content.length }}/{{ MAX_CONTENT_LENGTH }}
        </text>
        <text v-if="submitError" class="mt-copy block text-caption text-danger" role="alert">
          {{ submitError }}
        </text>
      </view>

      <view>
        <view class="flex items-end justify-between">
          <text class="section-heading">我的动态</text>
          <text v-if="listStatus === 'ready'" class="quiet-text">共 {{ total }} 条</text>
        </view>

        <view v-if="listStatus === 'loading'" class="mt-copy main-card p-action" aria-live="polite">
          <text class="text-body text-muted leading-body">审核状态加载中…</text>
        </view>

        <view
          v-else-if="listStatus === 'error'"
          class="mt-copy flex flex-col gap-copy rounded-card bg-danger-soft p-action"
          role="alert"
        >
          <text class="text-body text-ink leading-body">审核状态加载失败，请稍后重试</text>
          <button
            class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
            :class="listLoading ? 'opacity-50' : ''"
            :disabled="listLoading"
            :aria-disabled="listLoading"
            :loading="listLoading"
            @click="loadMine"
          >
            重新加载
          </button>
        </view>

        <view v-else-if="posts.length === 0" class="mt-copy main-card p-action">
          <text class="text-body text-muted leading-body">还没有提交过动态</text>
        </view>

        <view v-else class="mt-copy flex flex-col gap-copy">
          <view v-for="post in posts" :key="post.id" class="main-card p-action">
            <view class="flex items-center justify-between gap-copy">
              <text class="quiet-text">{{ formatDate(post.createdAt) }}</text>
              <text
                class="shrink-0 rounded-pill px-copy py-caption text-caption font-medium leading-caption"
                :class="statusTones[post.status]"
              >
                {{ statusLabels[post.status] }}
              </text>
            </view>
            <text class="mt-copy block text-body text-ink leading-body">{{ post.content }}</text>
            <view
              v-if="post.status === ADMIN_CONTENT_POST_STATUS.REJECTED && post.moderationReason"
              class="mt-copy rounded-control bg-danger-soft p-copy"
            >
              <text class="text-caption text-danger leading-caption">
                未通过原因：{{ post.moderationReason }}
              </text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <template #actions>
      <button
        class="h-button w-full flex items-center justify-center rounded-control p-0"
        :class="canSubmit ? 'bg-brand' : 'bg-brand-disabled'"
        :disabled="!canSubmit"
        :aria-disabled="!canSubmit"
        :loading="submitting"
        @click="submit"
      >
        <text
          class="text-button font-semibold leading-button"
          :class="canSubmit ? 'text-surface' : 'text-subtle'"
        >
          {{ submitting ? "提交中" : "提交审核" }}
        </text>
      </button>
    </template>
  </SubPageLayout>
</template>
