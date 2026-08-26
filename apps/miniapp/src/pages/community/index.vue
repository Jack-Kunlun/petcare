<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type {
  ClassroomArticleCategory,
  PublicClassroomArticleListItem,
  PublicCommunityPostListItem,
} from "@petcare/shared-types";
import {
  CLASSROOM_ARTICLE_CATEGORY,
  CLASSROOM_ARTICLE_CATEGORY_LABELS,
} from "@petcare/shared-types";
import { computed, ref } from "vue";
import { openCommunityPublishEntry } from "./publish-entry";
import { getClassroomArticles, getCommunityPosts } from "@/api/content";
import MainTabLayout from "@/components/MainTabLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const CLASSROOM_PAGE_SIZE = 10;
const COMMUNITY_PAGE_SIZE = 10;
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
const publishPending = ref(false);
const classroomHasMore = computed(() => classroomArticles.value.length < classroomTotal.value);
const featuredPosts = ref<PublicCommunityPostListItem[]>([]);
const featuredStatus = ref<"idle" | "loading" | "ready" | "error">("idle");
const featuredLoading = ref(false);
const featuredLoadMoreError = ref(false);
const featuredPage = ref(1);
const featuredTotal = ref(0);
const featuredHasMore = computed(() => featuredPosts.value.length < featuredTotal.value);

async function loadFeatured(reset = true): Promise<void> {
  if (featuredLoading.value) {
    return;
  }

  featuredLoading.value = true;
  featuredLoadMoreError.value = false;

  if (reset) {
    featuredStatus.value = "loading";
  }

  try {
    const page = reset ? 1 : featuredPage.value + 1;
    const response = await getCommunityPosts({ page, pageSize: COMMUNITY_PAGE_SIZE });

    featuredPosts.value = reset ? response.list : [...featuredPosts.value, ...response.list];
    featuredPage.value = response.page;
    featuredTotal.value = response.total;
    featuredStatus.value = "ready";
  } catch {
    if (reset) {
      featuredPosts.value = [];
      featuredTotal.value = 0;
      featuredStatus.value = "error";
    } else {
      featuredLoadMoreError.value = true;
    }
  } finally {
    featuredLoading.value = false;
  }
}

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

  if (tab.value === "featured" && featuredStatus.value === "idle") {
    void loadFeatured();
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

function loadMoreFeatured(): void {
  if (!featuredLoading.value && featuredHasMore.value) {
    void loadFeatured(false);
  }
}

function classroomCategoryLabel(category: ClassroomArticleCategory | null): string {
  return category ? CLASSROOM_ARTICLE_CATEGORY_LABELS[category] : "未分类";
}

function publishedDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

function communityDate(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function communityAvatar(post: PublicCommunityPostListItem): string {
  return post.author.avatar ?? getDefaultAvatar(post.id);
}

function openClassroomArticle(slug: string): void {
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(slug)}` });
}

function openCommunityArticle(id: string): void {
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
}

function openCommunityPublisher(): void {
  void openCommunityPublishEntry(publishPending);
}

onLoad((query = {}) => {
  if (query.tab === "classroom") {
    activeChannel.value = "classroom";
    void loadClassroom();

    return;
  }

  void loadFeatured();
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
          class="mx-page-horizontal mt-copy rounded-card from-brand to-brand-active bg-gradient-to-r p-card-padding text-surface shadow-card"
        >
          <view class="flex flex-col gap-caption">
            <text class="text-card font-semibold leading-card">真实养宠生活</text>
            <text class="text-caption leading-caption">这里仅展示审核通过的社区动态</text>
          </view>
        </view>

        <view class="mt-card flex items-center justify-between px-page-horizontal">
          <view class="flex items-end gap-sm">
            <text class="section-heading">社区精选</text>
            <text v-if="featuredStatus === 'ready'" class="quiet-text">
              {{ featuredTotal }} 条动态
            </text>
          </view>
          <button
            class="h-control rounded-control bg-transparent px-copy text-caption text-brand leading-caption"
            :class="featuredLoading ? 'opacity-50' : ''"
            :disabled="featuredLoading"
            :aria-disabled="featuredLoading"
            :loading="featuredLoading"
            @click="loadFeatured()"
          >
            刷新
          </button>
        </view>

        <view
          v-if="featuredStatus === 'loading'"
          class="mx-page-horizontal mt-copy main-card p-action"
          aria-live="polite"
        >
          <text class="text-body text-muted leading-body">社区动态加载中…</text>
        </view>

        <view
          v-else-if="featuredStatus === 'error'"
          class="mx-page-horizontal mt-copy flex flex-col gap-copy rounded-card bg-danger-soft p-action"
          role="alert"
        >
          <text class="text-body text-ink leading-body">社区动态加载失败，请稍后重试</text>
          <button
            class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
            :disabled="featuredLoading"
            :aria-disabled="featuredLoading"
            :loading="featuredLoading"
            @click="loadFeatured()"
          >
            重新加载
          </button>
        </view>

        <view
          v-else-if="featuredStatus === 'ready' && featuredPosts.length === 0"
          class="mx-page-horizontal mt-copy main-card p-action"
        >
          <text class="text-body text-muted leading-body">还没有已发布的社区动态</text>
        </view>

        <view
          v-else-if="featuredStatus === 'ready'"
          class="mx-page-horizontal mt-copy flex flex-col gap-copy"
        >
          <view v-for="post in featuredPosts" :key="post.id" class="overflow-hidden main-card">
            <view class="flex items-center justify-between p-card-padding pb-copy">
              <view class="flex items-center gap-copy">
                <image
                  class="h-avatar w-avatar rounded-full"
                  :src="communityAvatar(post)"
                  mode="aspectFill"
                />
                <view class="flex flex-col">
                  <text class="text-body text-ink font-semibold leading-label">
                    {{ post.author.displayName }}
                  </text>
                  <text class="quiet-text">{{ communityDate(post.createdAt) }}</text>
                </view>
              </view>
            </view>

            <view
              class="px-card-padding pb-copy"
              hover-class="opacity-80"
              @click="openCommunityArticle(post.id)"
            >
              <text class="text-body text-ink leading-body">{{ post.content }}</text>
            </view>

            <view
              v-if="post.mediaUrls.length > 0"
              class="grid grid-cols-3 mx-card-padding gap-sm"
              hover-class="opacity-80"
              @click="openCommunityArticle(post.id)"
            >
              <image
                v-for="url in post.mediaUrls"
                :key="url"
                class="h-card-cover w-full rounded-control"
                :src="url"
                mode="aspectFill"
              />
            </view>

            <view class="mt-copy border-t border-divider px-card-padding py-copy">
              <view class="flex items-center gap-action">
                <text class="quiet-text">赞 {{ post.likesCount }}</text>
                <text class="quiet-text">评论 {{ post.commentsCount }}</text>
              </view>
              <text class="mt-caption block quiet-text">关注与分享功能暂未开放</text>
            </view>
          </view>

          <view v-if="featuredLoadMoreError" class="flex flex-col gap-copy" role="alert">
            <text class="text-center text-caption text-danger leading-caption">
              更多动态加载失败
            </text>
            <button
              class="h-control border border-brand rounded-control bg-surface px-action text-body text-brand font-medium"
              :disabled="featuredLoading"
              :aria-disabled="featuredLoading"
              :loading="featuredLoading"
              @click="loadMoreFeatured"
            >
              重试加载更多
            </button>
          </view>
          <button
            v-else-if="featuredHasMore"
            class="h-control w-full border border-brand rounded-control bg-surface px-action text-body text-brand font-medium"
            :class="featuredLoading ? 'opacity-50' : ''"
            :disabled="featuredLoading"
            :aria-disabled="featuredLoading"
            :loading="featuredLoading"
            @click="loadMoreFeatured"
          >
            加载更多
          </button>
        </view>
      </template>
    </view>

    <template #floating>
      <button
        class="pointer-events-auto h-fab w-fab flex items-center justify-center rounded-full bg-brand p-0 shadow-float"
        :class="publishPending ? 'opacity-50' : ''"
        :disabled="publishPending"
        :aria-disabled="publishPending"
        aria-label="发布动态"
        @click="openCommunityPublisher"
      >
        <image class="h-glyph w-glyph" src="/static/main/plus.svg" mode="aspectFit" />
      </button>
    </template>
  </MainTabLayout>
</template>
