<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import type { PublicClassroomArticleListItem } from "@petcare/shared-types";
import { CLASSROOM_ARTICLE_CATEGORY_LABELS } from "@petcare/shared-types";
import { ref } from "vue";
import { getClassroomArticles } from "@/api/content";
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const HOME_CLASSROOM_PAGE_SIZE = 2;
const CLASSROOM_COVER_PLACEHOLDER = "/static/main/petcare-placeholder-light.svg";

const classroomArticles = ref<PublicClassroomArticleListItem[]>([]);
const classroomStatus = ref<"loading" | "ready" | "error">("loading");
const classroomLoading = ref(false);

function openClassroomArticle(slug: string) {
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(slug)}` });
}

function openClassroomList() {
  uni.redirectTo({ url: "/pages/community/index?tab=classroom" });
}

function openCommunityList() {
  uni.redirectTo({ url: "/pages/community/index" });
}

function openPetProfiles() {
  uni.redirectTo({ url: "/pages/profile/index" });
}

function classroomCategoryLabel(article: PublicClassroomArticleListItem): string {
  return article.category ? CLASSROOM_ARTICLE_CATEGORY_LABELS[article.category] : "未分类";
}

function publishedDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

async function loadHomeClassroom(): Promise<void> {
  if (classroomLoading.value) {
    return;
  }

  classroomLoading.value = true;
  classroomStatus.value = "loading";

  try {
    const response = await getClassroomArticles({ page: 1, pageSize: HOME_CLASSROOM_PAGE_SIZE });

    classroomArticles.value = response.list;
    classroomStatus.value = "ready";
  } catch {
    classroomArticles.value = [];
    classroomStatus.value = "error";
  } finally {
    classroomLoading.value = false;
  }
}

onShow(() => void loadHomeClassroom());
</script>

<template>
  <MainTabLayout active="home">
    <template #header>
      <view class="min-w-0 flex items-center justify-between">
        <view class="min-w-0 flex flex-1 items-center gap-copy">
          <view
            class="h-avatar w-avatar flex shrink-0 items-center justify-center rounded-full bg-brand text-body text-surface font-semibold"
          >
            宠
          </view>
          <view class="min-w-0 flex flex-col">
            <text class="text-caption text-muted leading-caption">个人开发版</text>
            <text class="truncate text-card text-ink font-semibold leading-card">PetCare 宠伴</text>
          </view>
        </view>

        <view
          class="ml-copy min-w-0 flex shrink items-center gap-caption rounded-pill bg-surface px-copy py-sm shadow-card"
        >
          <text class="truncate text-caption text-muted leading-caption">内容 · 社区 · 档案</text>
        </view>
      </view>
    </template>

    <view class="box-border flex flex-col pb-screen">
      <view
        class="relative mx-page-horizontal h-hero-main overflow-hidden rounded-card bg-surface shadow-card"
      >
        <image
          class="absolute inset-0 h-full w-full"
          src="/static/main/community-pet-5.jpg"
          mode="aspectFill"
        />
        <view
          class="absolute inset-0 from-surface via-surface/85 to-transparent bg-gradient-to-r"
          aria-hidden="true"
        />
        <view class="absolute left-card-padding top-card w-hero-copy flex flex-col gap-sm">
          <text class="text-amount text-ink font-semibold leading-section">记录宠物日常</text>
          <text class="text-caption text-muted leading-caption">
            管理宠物档案，浏览课堂与社区内容
          </text>
          <view
            class="mt-caption self-start rounded-pill bg-brand px-copy py-compact"
            hover-class="opacity-80"
            @click="openPetProfiles"
          >
            <text class="text-caption text-surface font-medium leading-caption">管理宠物档案</text>
          </view>
        </view>
      </view>

      <view class="mt-card px-page-horizontal">
        <text class="section-heading">从这里开始</text>
      </view>

      <view class="grid grid-cols-3 mx-page-horizontal mt-copy gap-copy">
        <view
          class="flex flex-col items-center gap-copy main-card p-copy text-center"
          role="button"
          aria-label="管理宠物档案"
          hover-class="opacity-80"
          @click="openPetProfiles"
        >
          <view class="h-icon w-icon flex items-center justify-center rounded-full bg-soft">
            <image class="h-glyph w-glyph" src="/static/main/profile-cat.png" mode="aspectFit" />
          </view>
          <view class="flex flex-col gap-caption">
            <text class="text-body text-ink font-medium leading-label">宠物档案</text>
            <text class="quiet-text">记录资料</text>
          </view>
        </view>

        <view
          class="flex flex-col items-center gap-copy main-card p-copy text-center"
          role="button"
          aria-label="浏览萌宠课堂"
          hover-class="opacity-80"
          @click="openClassroomList"
        >
          <view class="h-icon w-icon flex items-center justify-center rounded-full bg-soft">
            <image class="h-glyph w-glyph" src="/static/main/about.svg" mode="aspectFit" />
          </view>
          <view class="flex flex-col gap-caption">
            <text class="text-body text-ink font-medium leading-label">萌宠课堂</text>
            <text class="quiet-text">学习知识</text>
          </view>
        </view>

        <view
          class="flex flex-col items-center gap-copy main-card p-copy text-center"
          role="button"
          aria-label="浏览社区精选"
          hover-class="opacity-80"
          @click="openCommunityList"
        >
          <view class="h-icon w-icon flex items-center justify-center rounded-full bg-soft">
            <image
              class="h-glyph w-glyph"
              src="/static/main/tab-community-active.svg"
              mode="aspectFit"
            />
          </view>
          <view class="flex flex-col gap-caption">
            <text class="text-body text-ink font-medium leading-label">社区精选</text>
            <text class="quiet-text">分享日常</text>
          </view>
        </view>
      </view>

      <view class="mt-section flex items-center justify-between px-page-horizontal">
        <text class="section-heading">萌宠课堂</text>
        <view
          class="h-control flex items-center gap-caption"
          role="button"
          aria-label="查看全部课堂文章"
          hover-class="opacity-80"
          @click="openClassroomList"
        >
          <text class="text-caption text-brand leading-caption">全部文章</text>
          <image
            class="h-icon-xs w-icon-xs"
            src="/static/main/chevron-brand.svg"
            mode="aspectFit"
            aria-hidden="true"
          />
        </view>
      </view>

      <view
        v-if="classroomStatus === 'loading'"
        class="mx-page-horizontal mt-copy flex flex-col gap-copy"
        aria-label="课堂文章加载中"
        aria-live="polite"
      >
        <view
          v-for="index in HOME_CLASSROOM_PAGE_SIZE"
          :key="index"
          class="flex gap-copy main-card p-copy"
        >
          <view class="h-card-cover w-card-cover shrink-0 rounded-control bg-divider" />
          <view class="min-w-0 flex flex-1 flex-col gap-copy py-caption">
            <view class="h-icon-xs w-indicator rounded-pill bg-divider" />
            <view class="h-icon-xs w-full rounded-pill bg-divider" />
            <view class="h-icon-xs w-hero-copy rounded-pill bg-divider" />
          </view>
        </view>
      </view>

      <view
        v-else-if="classroomStatus === 'error'"
        class="mx-page-horizontal mt-copy flex flex-col gap-copy rounded-card bg-danger-soft p-action"
        role="alert"
      >
        <text class="text-body text-ink leading-body">课堂文章加载失败，请稍后重试</text>
        <button
          class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
          :class="classroomLoading ? 'opacity-50' : ''"
          :disabled="classroomLoading"
          :aria-disabled="classroomLoading"
          :loading="classroomLoading"
          @click="loadHomeClassroom"
        >
          重新加载
        </button>
      </view>

      <view
        v-else-if="classroomArticles.length === 0"
        class="mx-page-horizontal mt-copy main-card p-action"
      >
        <text class="text-body text-muted leading-body">暂无已发布的课堂文章</text>
      </view>

      <view v-else class="mx-page-horizontal mt-copy flex flex-col gap-copy">
        <view
          v-for="article in classroomArticles"
          :key="article.slug"
          class="flex gap-copy main-card p-copy"
          hover-class="opacity-80"
          @click="openClassroomArticle(article.slug)"
        >
          <image
            class="h-card-cover w-card-cover shrink-0 rounded-control"
            :src="article.coverUrl || CLASSROOM_COVER_PLACEHOLDER"
            mode="aspectFill"
            :aria-label="`${article.title}封面`"
          />
          <view class="min-w-0 flex flex-1 flex-col justify-between py-caption">
            <view class="flex flex-col gap-sm">
              <text class="text-caption text-brand leading-caption">
                {{ classroomCategoryLabel(article) }}
              </text>
              <text class="card-heading">{{ article.title }}</text>
            </view>
            <text v-if="article.publishedAt" class="quiet-text">
              发布于 {{ publishedDate(article.publishedAt) }}
            </text>
          </view>
        </view>
      </view>

      <view class="mt-section px-page-horizontal">
        <text class="section-heading">社区精选</text>
      </view>
      <view
        class="mx-page-horizontal mt-copy flex items-center justify-between gap-copy main-card p-action"
        hover-class="opacity-80"
        @click="openCommunityList"
      >
        <view class="min-w-0 flex flex-1 flex-col gap-sm">
          <text class="card-heading">发现真实养宠动态</text>
          <text class="meta-text">查看审核通过的社区分享</text>
        </view>
        <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
      </view>
    </view>
  </MainTabLayout>
</template>
