<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const tabs = ["文章", "动态", "服务", "照护者"] as const;

interface FavoriteItem {
  kind: string;
  title: string;
  detail: string;
  image: string;
  route?: string;
}

const items: FavoriteItem[] = [
  {
    kind: "文章",
    title: "换季掉毛别焦虑，做好这 4 件事就够了",
    detail: "日常护理 · 2.4k 阅读",
    image: "/static/main/community-pet-4.jpg",
    route: "/pages-content/classroom/article?id=article-1",
  },
  {
    kind: "动态",
    title: "第一次带旺财参加宠物友好市集",
    detail: "小林与旺财 · 286 赞",
    image: "/static/main/community-pet-2.jpg",
    route: "/pages-content/community/article?id=post-1",
  },
  {
    kind: "服务",
    title: "安心上门喂养",
    detail: "小林 · 4.9分 · ¥68/次",
    image: "/static/main/profile-cat.png",
    route: "/pages-account/services/detail?id=service-1",
  },
  {
    kind: "照护者",
    title: "小林",
    detail: "实名认证 · 已服务 128 次",
    image: "/static/main/owner-1.jpg",
    route: "/pages-account/caregivers/detail?id=caregiver-1",
  },
];

function openItem(route?: string) {
  if (route) {
    uni.navigateTo({ url: route });
  }
}
</script>

<template>
  <SubPageLayout title="我的收藏">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="h-control flex rounded-pill bg-surface p-caption shadow-card">
        <view
          v-for="(tab, index) in tabs"
          :key="tab"
          class="flex flex-1 items-center justify-center rounded-pill"
          :class="index === 0 ? 'bg-brand' : ''"
        >
          <text
            class="text-caption font-medium leading-caption"
            :class="index === 0 ? 'text-surface' : 'text-muted'"
          >
            {{ tab }}
          </text>
        </view>
      </view>

      <view
        v-for="item in items"
        :key="item.kind"
        class="flex items-center gap-copy main-card p-copy"
        :class="item.route ? '' : 'opacity-50'"
        :hover-class="item.route ? 'opacity-80' : 'none'"
        :aria-disabled="item.route ? undefined : 'true'"
        @click="openItem(item.route)"
      >
        <image
          class="h-mini-cover w-mini-cover shrink-0 rounded-control"
          :src="item.image"
          mode="aspectFill"
        />
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="text-caption text-brand leading-caption">{{ item.kind }}</text>
          <text class="mt-caption truncate card-heading">{{ item.title }}</text>
          <text class="mt-caption truncate quiet-text">{{ item.detail }}</text>
        </view>
        <image
          v-if="item.route"
          class="h-icon-xs w-icon-xs"
          src="/static/main/chevron.svg"
          mode="aspectFit"
        />
      </view>
    </view>
  </SubPageLayout>
</template>
