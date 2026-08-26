<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { PublicCommunityPostDetail } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getCommunityPost } from "@/api/content";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";

const postId = ref("");
const post = ref<PublicCommunityPostDetail | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
const loading = ref(false);
const avatar = computed(() =>
  post.value ? (post.value.author.avatar ?? getDefaultAvatar(post.value.id)) : "",
);

function formatDate(value: string): string {
  return value.slice(0, 16).replace("T", " ");
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
  } catch {
    post.value = null;
    status.value = "error";
  } finally {
    loading.value = false;
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
          <text class="quiet-text">点赞、评论、关注与分享功能暂未开放</text>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
