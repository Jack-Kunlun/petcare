<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { PublicClassroomArticleDetail } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getClassroomArticle } from "@/api/content";
import { MiniappApiError } from "@/api/request";
import SubPageLayout from "@/components/SubPageLayout.vue";

const articleSlug = ref("");
const article = ref<PublicClassroomArticleDetail | null>(null);
const status = ref<"loading" | "ready" | "error" | "unavailable">("loading");
const loading = ref(false);
const articleActions = [
  { label: "评论", icon: "/static/main/community-comment.svg" },
  { label: "收藏", icon: "/static/main/favorite.svg" },
  { label: "分享", icon: "/static/main/community-share.svg" },
] as const;
const byline = computed(() => {
  if (!article.value) {
    return "";
  }

  const author = article.value.author?.displayName ?? "PetCare 编辑部";
  const publishedDate = article.value.publishedAt?.slice(0, 10);

  return publishedDate ? `${author} · ${publishedDate}` : author;
});

async function load(): Promise<void> {
  if (loading.value || !articleSlug.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";

  try {
    article.value = await getClassroomArticle(articleSlug.value);
    status.value = "ready";
  } catch (error) {
    article.value = null;
    status.value =
      error instanceof MiniappApiError && error.statusCode === 404 ? "unavailable" : "error";
  } finally {
    loading.value = false;
  }
}

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    articleSlug.value = query.id;
    void load();

    return;
  }

  status.value = "unavailable";
});
</script>

<template>
  <SubPageLayout title="萌宠课堂">
    <view class="flex flex-col gap-card px-action py-card">
      <view v-if="status === 'loading'" class="main-card p-action" aria-live="polite">
        <text class="text-body text-muted leading-body">文章加载中…</text>
      </view>

      <view v-else-if="status === 'unavailable'" class="rounded-card bg-soft p-action" role="alert">
        <text class="text-body text-ink leading-body">文章已下线或不存在</text>
      </view>

      <view
        v-else-if="status === 'error'"
        class="flex flex-col gap-copy rounded-card bg-danger-soft p-action"
        role="alert"
      >
        <text class="text-body text-ink leading-body">文章加载失败，请稍后重试</text>
        <button
          class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
          :class="loading ? 'opacity-50' : ''"
          :disabled="loading"
          :aria-disabled="loading"
          :loading="loading"
          @click="load"
        >
          重新加载
        </button>
      </view>

      <template v-else-if="article">
        <image
          v-if="article.coverUrl"
          class="h-hero w-full rounded-card"
          :src="article.coverUrl"
          mode="aspectFill"
        />

        <view class="flex flex-col gap-copy">
          <text class="page-heading">{{ article.title }}</text>
          <view class="flex items-center gap-copy">
            <image
              v-if="article.author?.avatar"
              class="h-avatar w-avatar rounded-full"
              :src="article.author.avatar"
              mode="aspectFill"
            />
            <view
              v-else
              class="h-avatar w-avatar flex items-center justify-center rounded-full bg-brand text-caption text-surface font-semibold"
              aria-hidden="true"
            >
              宠
            </view>
            <text class="quiet-text">{{ byline }}</text>
          </view>
          <text class="text-body text-muted leading-body">{{ article.summary }}</text>
        </view>

        <view class="main-card p-action">
          <rich-text class="text-body text-ink leading-body" :nodes="article.bodyHtml" />
        </view>
      </template>
    </view>

    <template #actions>
      <view class="flex opacity-50" aria-disabled="true">
        <view
          v-for="action in articleActions"
          :key="action.label"
          class="h-control flex flex-1 items-center justify-center gap-sm"
        >
          <image class="h-icon-sm w-icon-sm" :src="action.icon" mode="aspectFit" />
          <text class="text-caption text-muted leading-caption">{{ action.label }}</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
