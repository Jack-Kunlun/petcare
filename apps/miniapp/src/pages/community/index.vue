<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type {
  ClassroomArticleCategory,
  PublicClassroomArticleListItem,
} from "@petcare/shared-types";
import {
  CLASSROOM_ARTICLE_CATEGORY,
  CLASSROOM_ARTICLE_CATEGORY_LABELS,
} from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getClassroomArticles } from "@/api/content";
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const CLASSROOM_PAGE_SIZE = 10;
const channelTabs = [
  { value: "featured", label: "社区精选", disabled: false },
  { value: "classroom", label: "萌宠课堂", disabled: false },
  { value: "nearby", label: "附近动态", disabled: true },
] as const;
const categoryOptions = Object.values(CLASSROOM_ARTICLE_CATEGORY).map((value) => ({
  value,
  label: CLASSROOM_ARTICLE_CATEGORY_LABELS[value],
}));

const activeChannel = ref<(typeof channelTabs)[number]["value"]>("featured");
const classroomArticles = ref<PublicClassroomArticleListItem[]>([]);
const classroomKeyword = ref("");
const classroomAppliedKeyword = ref("");
const classroomCategory = ref<ClassroomArticleCategory | null>(null);
const classroomStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const classroomLoading = ref(false);
const classroomLoadMoreError = ref(false);
const classroomPage = ref(1);
const classroomTotal = ref(0);
const classroomHasMore = computed(() => classroomArticles.value.length < classroomTotal.value);

const posts = [
  {
    id: "post-1",
    avatar: "/static/main/owner-1.jpg",
    author: "小林与旺财",
    detail: "静安区 · 12分钟前",
    text: "今天第一次带旺财去宠物友好市集，见到好多新朋友，回家路上还一直回头看。",
    image: "/static/main/community-pet-2.jpg",
    tag: "#城市养宠日记",
    likes: "286",
    comments: "42",
  },
  {
    id: "post-2",
    avatar: "/static/main/owner-5.jpg",
    author: "栗子妈妈",
    detail: "长宁区 · 35分钟前",
    text: "换季梳毛第三天，终于找到了栗子最喜欢的梳子。动作慢一点，它就会主动趴好啦。",
    image: "/static/main/community-pet-3.jpg",
    tag: "#猫咪护理",
    likes: "168",
    comments: "31",
  },
  {
    id: "post-3",
    avatar: "/static/main/owner-4.jpg",
    author: "阿哲和团子",
    detail: "普陀区 · 1小时前",
    text: "清晨散步的路线收藏好了，树荫多、人也少，特别适合怕热的小短腿。",
    image: "/static/main/community-pet-5.jpg",
    tag: "#附近遛狗路线",
    likes: "94",
    comments: "18",
  },
] as const;

async function loadClassroom(reset = true): Promise<void> {
  if (classroomLoading.value) {
    return;
  }

  classroomLoading.value = true;
  classroomLoadMoreError.value = false;

  if (reset) {
    classroomStatus.value = "loading";
  }

  try {
    const page = reset ? 1 : classroomPage.value + 1;
    const keyword = reset ? classroomKeyword.value.trim() : classroomAppliedKeyword.value;

    if (reset) {
      classroomAppliedKeyword.value = keyword;
    }

    const response = await getClassroomArticles({
      page,
      pageSize: CLASSROOM_PAGE_SIZE,
      keyword: keyword || undefined,
      category: classroomCategory.value ?? undefined,
    });

    classroomArticles.value = reset
      ? response.list
      : [...classroomArticles.value, ...response.list];
    classroomPage.value = response.page;
    classroomTotal.value = response.total;
    classroomStatus.value = "ready";
  } catch {
    if (reset) {
      classroomArticles.value = [];
      classroomTotal.value = 0;
      classroomStatus.value = "error";
    } else {
      classroomLoadMoreError.value = true;
    }
  } finally {
    classroomLoading.value = false;
  }
}

function selectChannel(tab: (typeof channelTabs)[number]): void {
  if (tab.disabled) {
    return;
  }

  activeChannel.value = tab.value;

  if (tab.value === "classroom" && classroomStatus.value === "idle") {
    void loadClassroom();
  }
}

function selectCategory(category: ClassroomArticleCategory | null): void {
  if (classroomLoading.value || classroomCategory.value === category) {
    return;
  }

  classroomCategory.value = category;
  void loadClassroom();
}

function searchClassroom(): void {
  if (!classroomLoading.value) {
    void loadClassroom();
  }
}

function loadMoreClassroom(): void {
  if (!classroomLoading.value && classroomHasMore.value) {
    void loadClassroom(false);
  }
}

function classroomCategoryLabel(category: ClassroomArticleCategory | null): string {
  return category ? CLASSROOM_ARTICLE_CATEGORY_LABELS[category] : "未分类";
}

function publishedDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

function openClassroomArticle(slug: string): void {
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(slug)}` });
}

function openCommunityArticle(id: string): void {
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
}

onLoad((query = {}) => {
  if (query.tab === "classroom") {
    activeChannel.value = "classroom";
    void loadClassroom();
  }
});
</script>

<template>
  <MainTabLayout active="community">
    <template #header>
      <text class="page-heading">社区</text>
    </template>

    <view class="box-border flex flex-col pb-screen">
      <view class="mx-page-horizontal h-segment flex rounded-control bg-divider p-caption">
        <view
          v-for="tab in channelTabs"
          :key="tab.value"
          role="tab"
          :aria-selected="activeChannel === tab.value"
          :aria-disabled="tab.disabled"
          class="flex flex-1 items-center justify-center rounded-chip"
          :class="[
            activeChannel === tab.value ? 'bg-surface shadow-card' : '',
            tab.disabled ? 'opacity-50' : '',
          ]"
          :hover-class="tab.disabled ? 'none' : 'opacity-80'"
          @click="selectChannel(tab)"
        >
          <text
            class="text-caption font-medium leading-caption"
            :class="activeChannel === tab.value ? 'text-brand' : 'text-muted'"
          >
            {{ tab.label }}
          </text>
        </view>
      </view>

      <template v-if="activeChannel === 'classroom'">
        <view class="mx-page-horizontal mt-card flex gap-copy">
          <view
            class="h-control min-w-0 flex flex-1 items-center gap-sm rounded-control bg-surface px-copy shadow-card"
          >
            <image
              class="h-icon-sm w-icon-sm"
              src="/static/main/search.svg"
              mode="aspectFit"
              aria-hidden="true"
            />
            <input
              v-model="classroomKeyword"
              class="h-full min-w-0 flex-1 text-body text-ink"
              aria-label="搜索课堂文章"
              confirm-type="search"
              placeholder="搜索专业养宠知识"
              :disabled="classroomLoading"
              :aria-disabled="classroomLoading"
              @confirm="searchClassroom"
            />
          </view>
          <button
            class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
            :class="classroomLoading ? 'opacity-50' : ''"
            :disabled="classroomLoading"
            :aria-disabled="classroomLoading"
            :loading="classroomLoading"
            @click="searchClassroom"
          >
            搜索
          </button>
        </view>

        <scroll-view class="mt-copy w-full" scroll-x :show-scrollbar="false">
          <view class="flex gap-sm px-page-horizontal pb-sm">
            <view
              class="shrink-0 rounded-pill px-copy py-sm"
              :class="[
                classroomCategory === null ? 'bg-brand text-surface' : 'bg-surface text-muted',
                classroomLoading ? 'opacity-50' : '',
              ]"
              role="button"
              :aria-pressed="classroomCategory === null"
              :aria-disabled="classroomLoading"
              :hover-class="classroomLoading ? 'none' : 'opacity-80'"
              @click="selectCategory(null)"
            >
              <text class="text-caption font-medium leading-caption">全部</text>
            </view>
            <view
              v-for="option in categoryOptions"
              :key="option.value"
              class="shrink-0 rounded-pill px-copy py-sm"
              :class="[
                classroomCategory === option.value
                  ? 'bg-brand text-surface'
                  : 'bg-surface text-muted',
                classroomLoading ? 'opacity-50' : '',
              ]"
              role="button"
              :aria-pressed="classroomCategory === option.value"
              :aria-disabled="classroomLoading"
              :hover-class="classroomLoading ? 'none' : 'opacity-80'"
              @click="selectCategory(option.value)"
            >
              <text class="text-caption font-medium leading-caption">{{ option.label }}</text>
            </view>
          </view>
        </scroll-view>

        <view
          v-if="classroomStatus === 'loading'"
          class="mx-page-horizontal mt-copy main-card p-action"
          aria-live="polite"
        >
          <text class="text-body text-muted leading-body">课堂文章加载中…</text>
        </view>

        <view
          v-else-if="classroomStatus === 'error'"
          class="mx-page-horizontal mt-copy flex flex-col gap-copy rounded-card bg-danger-soft p-action"
          role="alert"
        >
          <text class="text-body text-ink leading-body">课堂文章加载失败，请稍后重试</text>
          <button
            class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
            :disabled="classroomLoading"
            :aria-disabled="classroomLoading"
            :loading="classroomLoading"
            @click="loadClassroom()"
          >
            重新加载
          </button>
        </view>

        <view
          v-else-if="classroomStatus === 'ready' && classroomArticles.length === 0"
          class="mx-page-horizontal mt-copy main-card p-action"
        >
          <text class="text-body text-muted leading-body">未找到符合条件的课堂文章</text>
        </view>

        <view v-else-if="classroomStatus === 'ready'" class="mx-page-horizontal mt-copy">
          <view class="flex flex-col gap-copy">
            <view
              v-for="article in classroomArticles"
              :key="article.slug"
              class="flex gap-copy main-card p-copy"
              hover-class="opacity-80"
              @click="openClassroomArticle(article.slug)"
            >
              <image
                v-if="article.coverUrl"
                class="h-card-cover w-card-cover shrink-0 rounded-control"
                :src="article.coverUrl"
                mode="aspectFill"
              />
              <view
                v-else
                class="h-card-cover w-card-cover flex shrink-0 items-center justify-center rounded-control bg-soft"
                aria-hidden="true"
              >
                <text class="text-card text-brand font-semibold leading-card">宠</text>
              </view>
              <view class="min-w-0 flex flex-1 flex-col gap-sm py-caption">
                <text class="text-caption text-brand leading-caption">
                  {{ classroomCategoryLabel(article.category) }}
                </text>
                <text class="card-heading">{{ article.title }}</text>
                <text class="line-clamp-2 meta-text">{{ article.summary }}</text>
                <text class="quiet-text">
                  {{ article.author?.displayName ?? "PetCare 编辑部" }}
                  <template v-if="article.publishedAt">
                    · {{ publishedDate(article.publishedAt) }}
                  </template>
                </text>
              </view>
            </view>
          </view>

          <view v-if="classroomLoadMoreError" class="mt-copy flex flex-col gap-copy" role="alert">
            <text class="text-center text-caption text-danger leading-caption">
              更多文章加载失败
            </text>
            <button
              class="h-control border border-brand rounded-control bg-surface px-action text-body text-brand font-medium"
              :disabled="classroomLoading"
              :aria-disabled="classroomLoading"
              :loading="classroomLoading"
              @click="loadMoreClassroom"
            >
              重试加载更多
            </button>
          </view>
          <button
            v-else-if="classroomHasMore"
            class="mt-copy h-control w-full border border-brand rounded-control bg-surface px-action text-body text-brand font-medium"
            :class="classroomLoading ? 'opacity-50' : ''"
            :disabled="classroomLoading"
            :aria-disabled="classroomLoading"
            :loading="classroomLoading"
            @click="loadMoreClassroom"
          >
            加载更多
          </button>
        </view>
      </template>

      <template v-else>
        <view
          class="mx-page-horizontal mt-copy flex items-center justify-between rounded-card from-brand to-brand-active bg-gradient-to-r p-card-padding text-surface shadow-card"
        >
          <view class="flex flex-col gap-caption">
            <text class="text-card font-semibold leading-card">今日社区活力</text>
            <text class="text-caption leading-caption">分享真实养宠生活，发现身边同好</text>
          </view>
          <view class="flex gap-action">
            <view class="flex flex-col items-center">
              <text class="text-card font-semibold leading-card">328</text>
              <text class="text-micro leading-micro">今日新增</text>
            </view>
            <view class="flex flex-col items-center">
              <text class="text-card font-semibold leading-card">2.4k</text>
              <text class="text-micro leading-micro">互动</text>
            </view>
          </view>
        </view>

        <view class="mt-card flex items-center justify-between px-page-horizontal">
          <view class="flex items-end gap-sm">
            <text class="section-heading">社区精选</text>
            <text class="quiet-text">1,286 人正在这里</text>
          </view>
          <text class="text-caption text-brand leading-caption">刷新</text>
        </view>

        <view class="mx-page-horizontal mt-copy flex flex-col gap-copy">
          <view v-for="post in posts" :key="post.author" class="overflow-hidden main-card">
            <view class="flex items-center justify-between p-card-padding pb-copy">
              <view class="flex items-center gap-copy">
                <image
                  class="h-avatar w-avatar rounded-full"
                  :src="post.avatar"
                  mode="aspectFill"
                />
                <view class="flex flex-col">
                  <text class="text-body text-ink font-semibold leading-label">
                    {{ post.author }}
                  </text>
                  <text class="quiet-text">{{ post.detail }}</text>
                </view>
              </view>
              <view
                class="border border-brand rounded-pill px-copy py-caption opacity-50"
                aria-disabled="true"
              >
                <text class="text-caption text-brand font-medium leading-caption">关注</text>
              </view>
            </view>

            <view
              class="px-card-padding pb-copy"
              hover-class="opacity-80"
              @click="openCommunityArticle(post.id)"
            >
              <text class="text-body text-ink leading-body">{{ post.text }}</text>
            </view>

            <view
              class="relative mx-card-padding h-hero-main overflow-hidden rounded-control"
              hover-class="opacity-80"
              @click="openCommunityArticle(post.id)"
            >
              <image class="h-full w-full" :src="post.image" mode="aspectFill" />
              <view class="absolute bottom-sm left-sm rounded-pill bg-ink px-sm py-caption">
                <text class="text-caption text-surface leading-caption">{{ post.tag }}</text>
              </view>
            </view>

            <view
              class="mt-copy flex items-center border-t border-divider px-card-padding py-copy opacity-50"
              aria-disabled="true"
            >
              <view class="h-control flex flex-1 items-center gap-sm">
                <image
                  class="h-icon-sm w-icon-sm"
                  src="/static/main/community-like.svg"
                  mode="aspectFit"
                />
                <text class="text-caption text-muted leading-caption">{{ post.likes }}</text>
              </view>
              <view class="h-control flex flex-1 items-center justify-center gap-sm">
                <image
                  class="h-icon-sm w-icon-sm"
                  src="/static/main/community-comment.svg"
                  mode="aspectFit"
                />
                <text class="text-caption text-muted leading-caption">{{ post.comments }}</text>
              </view>
              <view class="h-control flex flex-1 items-center justify-end gap-sm">
                <image
                  class="h-icon-sm w-icon-sm"
                  src="/static/main/community-share.svg"
                  mode="aspectFit"
                />
                <text class="text-caption text-muted leading-caption">分享</text>
              </view>
            </view>
          </view>
        </view>
      </template>
    </view>

    <template #floating>
      <view
        class="h-fab w-fab flex items-center justify-center rounded-full bg-brand opacity-50 shadow-float"
        aria-label="发布动态"
        aria-disabled="true"
      >
        <image class="h-glyph w-glyph" src="/static/main/plus.svg" mode="aspectFit" />
      </view>
    </template>
  </MainTabLayout>
</template>
