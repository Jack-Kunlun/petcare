<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { PublicClassroomArticleDetail } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getClassroomArticle } from "@/api/content";
import { MiniappApiError } from "@/api/request";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const articleSlug = ref("");
const article = ref<PublicClassroomArticleDetail | null>(null);
const status = ref<"loading" | "ready" | "error" | "unavailable">("loading");
const loading = ref(false);
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

function returnToClassroom(): void {
  uni.redirectTo({ url: "/pages/community/index?tab=classroom" });
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
      <PcStatePanel v-if="status === 'loading'" status="loading" title="文章加载中…" />

      <PcStatePanel
        v-else-if="status === 'unavailable'"
        status="unavailable"
        title="文章已下线或不存在"
        description="请返回萌宠课堂选择其他文章。"
        primary-label="返回萌宠课堂"
        @primary="returnToClassroom"
      />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="文章加载失败"
        description="请检查网络后重试。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="load"
      />

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
  </SubPageLayout>
</template>
