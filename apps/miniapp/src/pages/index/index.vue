<script setup lang="ts">
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

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

function openClassroomArticle(id: string) {
  uni.navigateTo({ url: `/pages-content/classroom/article?id=${encodeURIComponent(id)}` });
}

function openCommunityArticle(id: string) {
  uni.navigateTo({ url: `/pages-content/community/article?id=${encodeURIComponent(id)}` });
}

function openBountyTab() {
  uni.switchTab({ url: "/pages/bounty/index" });
}

const classroomArticles = [
  {
    id: "article-1",
    image: "/static/main/community-pet-4.jpg",
    tag: "日常护理",
    title: "换季掉毛别焦虑，做好这 4 件事就够了",
    reads: "2.4k 阅读",
  },
  {
    id: "article-2",
    image: "/static/main/community-pet-5.jpg",
    tag: "科学喂养",
    title: "幼犬第一次换粮，如何平稳度过适应期？",
    reads: "1.8k 阅读",
  },
] as const;
</script>

<template>
  <MainTabLayout active="home">
    <view class="box-border flex flex-col pb-screen">
      <view class="h-header flex items-center justify-between px-action">
        <view class="min-w-0 flex items-center gap-copy">
          <view
            class="h-avatar w-avatar flex shrink-0 items-center justify-center rounded-full bg-brand text-body text-surface font-semibold"
          >
            郑
          </view>
          <view class="min-w-0 flex flex-col">
            <text class="text-caption text-muted leading-caption">早上好</text>
            <text class="text-card text-ink font-semibold leading-card">郑先生</text>
          </view>
        </view>

        <view
          class="flex items-center gap-caption rounded-pill bg-surface px-copy py-sm shadow-card"
        >
          <image class="h-icon-xs w-icon-xs" src="/static/main/location.svg" mode="aspectFit" />
          <text class="text-caption text-muted leading-caption">上海市 · 静安区</text>
        </view>
      </view>

      <view
        class="relative mx-action h-hero-main overflow-hidden rounded-card bg-surface shadow-card"
      >
        <image
          class="absolute inset-0 h-full w-full"
          src="/static/main/home-hero-trusted.png"
          mode="aspectFill"
        />
        <view class="absolute left-action top-card w-hero-copy flex flex-col gap-sm">
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

      <view class="mt-card flex items-center justify-between px-action">
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

      <view class="mx-action mt-copy main-card p-action">
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

      <view class="mt-section flex items-center justify-between px-action">
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
        <view class="flex gap-copy px-action pb-sm">
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

      <view class="mt-section flex items-center justify-between px-action">
        <text class="section-heading">养宠小课堂</text>
        <text
          class="text-caption text-brand leading-caption"
          hover-class="opacity-80"
          @click="openClassroomArticle('article-1')"
        >
          全部文章
        </text>
      </view>

      <view class="mx-action mt-copy flex flex-col gap-copy">
        <view
          v-for="article in classroomArticles"
          :key="article.title"
          class="flex gap-copy main-card p-copy"
          hover-class="opacity-80"
          @click="openClassroomArticle(article.id)"
        >
          <image
            class="h-card-cover w-card-cover shrink-0 rounded-control"
            :src="article.image"
            mode="aspectFill"
          />
          <view class="min-w-0 flex flex-1 flex-col justify-between py-caption">
            <view class="flex flex-col gap-sm">
              <text class="text-caption text-brand leading-caption">{{ article.tag }}</text>
              <text class="card-heading">{{ article.title }}</text>
            </view>
            <text class="quiet-text">{{ article.reads }}</text>
          </view>
        </view>
      </view>

      <view class="mt-section px-action">
        <text class="section-heading">社区精选</text>
      </view>
      <view
        class="mx-action mt-copy overflow-hidden main-card"
        hover-class="opacity-80"
        @click="openCommunityArticle('post-1')"
      >
        <image
          class="h-hero-main w-full"
          src="/static/main/community-pet-2.jpg"
          mode="aspectFill"
        />
        <view class="flex flex-col gap-sm p-action">
          <text class="card-heading">第一次带旺财参加宠物友好市集，开心到不想回家</text>
          <text class="meta-text">来自 小林与旺财 · 1.2k 人正在讨论</text>
        </view>
      </view>
    </view>
  </MainTabLayout>
</template>
