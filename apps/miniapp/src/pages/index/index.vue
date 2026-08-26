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

const bountyCards = [
  {
    id: "reward-2",
    image: "/static/main/community-pet-2.jpg",
    pet: "旺财 · 金毛",
    service: "周末遛狗 · 2次",
    location: "静安区 · 1.2km",
    price: "¥68/次",
  },
  {
    id: "reward-1",
    image: "/static/main/community-pet-1.jpg",
    pet: "咪咪 · 英短",
    service: "上门喂养 · 今天",
    location: "长宁区 · 2.6km",
    price: "¥58/次",
  },
  {
    id: "reward-3",
    image: "/static/main/community-pet-3.jpg",
    pet: "团团 · 布偶",
    service: "上门梳毛 · 明天",
    location: "普陀区 · 3.1km",
    price: "¥80/次",
  },
] as const;

function openOrders() {
  uni.navigateTo({ url: "/pages-care/orders/index" });
}

function openOrder() {
  uni.navigateTo({ url: "/pages-care/order/detail?id=order-1" });
}

function openChat() {
  uni.navigateTo({ url: "/pages-care/chat/index?userId=caregiver-1" });
}

function openReward(id: string) {
  uni.navigateTo({ url: `/pages-bounty/reward/detail?id=${encodeURIComponent(id)}` });
}

function openClassroomArticle(slug: string) {
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(slug)}` });
}

function openClassroomList() {
  uni.redirectTo({ url: "/pages/community/index?tab=classroom" });
}

function openCommunityArticle(id: string) {
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
}

function openBountyTab() {
  uni.redirectTo({ url: "/pages/bounty/index" });
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
            郑
          </view>
          <view class="min-w-0 flex flex-col">
            <text class="text-caption text-muted leading-caption">早上好</text>
            <text class="truncate text-card text-ink font-semibold leading-card">郑先生</text>
          </view>
        </view>

        <view
          class="ml-copy min-w-0 flex shrink items-center gap-caption rounded-pill bg-surface px-copy py-sm shadow-card"
        >
          <image class="h-icon-xs w-icon-xs" src="/static/main/location.svg" mode="aspectFit" />
          <text class="truncate text-caption text-muted leading-caption">上海市 · 静安区</text>
        </view>
      </view>
    </template>

    <view class="box-border flex flex-col pb-screen">
      <view
        class="relative mx-page-horizontal h-hero-main overflow-hidden rounded-card bg-surface shadow-card"
      >
        <image
          class="absolute inset-0 h-full w-full"
          src="/static/main/home-hero-trusted.png"
          mode="aspectFill"
        />
        <view class="absolute left-card-padding top-card w-hero-copy flex flex-col gap-sm">
          <text class="text-amount text-ink font-semibold leading-section">专业照护，就在身边</text>
          <text class="text-caption text-muted leading-caption"
            >实名认证照护者，让每次托付更安心</text
          >
          <view
            class="mt-caption self-start rounded-pill bg-brand px-copy py-compact"
            hover-class="opacity-80"
            @click="openBountyTab"
          >
            <text class="text-caption text-surface font-medium leading-caption">立即发现</text>
          </view>
        </view>
        <view class="absolute bottom-sm left-0 right-0 flex justify-center gap-caption">
          <view class="h-dot w-indicator rounded-pill bg-brand" />
          <view class="h-dot w-dot rounded-full bg-border" />
          <view class="h-dot w-dot rounded-full bg-border" />
        </view>
      </view>

      <view class="mt-card flex items-center justify-between px-page-horizontal">
        <text class="section-heading">我的服务</text>
        <view class="flex items-center gap-caption" hover-class="opacity-80" @click="openOrders">
          <text class="text-caption text-brand leading-caption">查看全部</text>
          <image
            class="h-icon-xs w-icon-xs"
            src="/static/main/chevron-brand.svg"
            mode="aspectFit"
          />
        </view>
      </view>

      <view class="mx-page-horizontal mt-copy main-card p-card-padding">
        <view class="flex items-center justify-between">
          <view class="flex items-center gap-copy">
            <image
              class="h-avatar w-avatar rounded-full"
              src="/static/main/home-pet-avatar.png"
              mode="aspectFill"
            />
            <view class="flex flex-col">
              <text class="card-heading">咪咪 · 英短蓝猫</text>
              <text class="meta-text">上门喂养 · 第 2 次服务</text>
            </view>
          </view>
          <view class="rounded-pill bg-success-soft px-sm py-caption">
            <text class="text-caption text-success font-medium leading-caption">服务进行中</text>
          </view>
        </view>

        <view class="mt-action flex items-center justify-between">
          <text class="meta-text">预计 12:30 到达</text>
          <text class="text-caption text-brand font-medium leading-caption">已完成 65%</text>
        </view>
        <view class="mt-sm h-progress overflow-hidden rounded-pill bg-divider">
          <view class="h-full rounded-pill bg-brand" style="width: 65%" />
        </view>

        <view class="mt-action flex gap-copy">
          <view
            class="h-segment flex flex-1 items-center justify-center border border-border rounded-control bg-surface"
            hover-class="opacity-80"
            @click="openChat"
          >
            <text class="text-body text-muted font-medium leading-label">联系照护者</text>
          </view>
          <view
            class="h-segment flex flex-1 items-center justify-center rounded-control bg-brand"
            hover-class="opacity-80"
            @click="openOrder"
          >
            <text class="text-body text-surface font-medium leading-label">查看服务记录</text>
          </view>
        </view>
      </view>

      <view class="mt-section flex items-center justify-between px-page-horizontal">
        <text class="section-heading">附近热门悬赏</text>
        <text
          class="text-caption text-brand leading-caption"
          hover-class="opacity-80"
          @click="openBountyTab"
        >
          更多
        </text>
      </view>

      <scroll-view class="mt-copy w-full" scroll-x :show-scrollbar="false">
        <view class="flex gap-copy px-page-horizontal pb-sm">
          <view
            v-for="item in bountyCards"
            :key="item.pet"
            class="w-feed-card shrink-0 main-card p-copy"
            hover-class="opacity-80"
            @click="openReward(item.id)"
          >
            <view class="flex gap-copy">
              <image
                class="h-mini-cover w-mini-cover shrink-0 rounded-control"
                :src="item.image"
                mode="aspectFill"
              />
              <view class="min-w-0 flex flex-1 flex-col">
                <text class="truncate card-heading">{{ item.pet }}</text>
                <text class="mt-caption truncate meta-text">{{ item.service }}</text>
                <text class="mt-caption truncate quiet-text">{{ item.location }}</text>
              </view>
            </view>
            <view class="mt-copy flex items-center justify-between border-t border-divider pt-copy">
              <text class="text-amount text-danger font-semibold leading-card">{{
                item.price
              }}</text>
              <text class="text-caption text-brand leading-caption">查看详情</text>
            </view>
          </view>
        </view>
      </scroll-view>

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
        class="mx-page-horizontal mt-copy overflow-hidden main-card"
        hover-class="opacity-80"
        @click="openCommunityArticle('post-1')"
      >
        <image
          class="h-hero-main w-full"
          src="/static/main/community-pet-2.jpg"
          mode="aspectFill"
        />
        <view class="flex flex-col gap-sm p-card-padding">
          <text class="card-heading">第一次带旺财参加宠物友好市集，开心到不想回家</text>
          <text class="meta-text">来自 小林与旺财 · 1.2k 人正在讨论</text>
        </view>
      </view>
    </view>
  </MainTabLayout>
</template>
