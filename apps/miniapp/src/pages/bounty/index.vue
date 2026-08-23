<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getBountyMode } from "./bounty-mode";
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const filters = ["全部服务", "上门喂养", "遛狗", "洗护美容", "寄养"] as const;

const bounties = [
  {
    id: "reward-1",
    image: "/static/main/community-pet-1.jpg",
    pet: "咪咪 · 英国蓝猫",
    service: "上门喂养 · 2次",
    time: "今天 14:00–16:00",
    location: "静安区悦庭花园 · 1.2km",
    price: "¥68/次",
    budget: "预算 ¥50–80",
    applicants: "3人报名",
    owner: "郑先生",
    avatar: "/static/main/owner-2.jpg",
    urgent: true,
  },
  {
    id: "reward-2",
    image: "/static/main/community-pet-2.jpg",
    pet: "旺财 · 金毛",
    service: "遛狗 · 60分钟",
    time: "今天 18:30–19:30",
    location: "静安公园南门 · 2.0km",
    price: "¥76/次",
    budget: "预算 ¥60–90",
    applicants: "5人报名",
    owner: "林女士",
    avatar: "/static/main/owner-1.jpg",
    urgent: false,
  },
  {
    id: "reward-3",
    image: "/static/main/community-pet-3.jpg",
    pet: "团团 · 布偶猫",
    service: "上门洗护 · 基础护理",
    time: "明天 10:00–12:00",
    location: "长宁区中山公园 · 2.8km",
    price: "¥128/次",
    budget: "预算 ¥100–150",
    applicants: "2人报名",
    owner: "陈女士",
    avatar: "/static/main/owner-3.jpg",
    urgent: false,
  },
  {
    id: "reward-4",
    image: "/static/main/community-pet-4.jpg",
    pet: "糯米 · 西施犬",
    service: "洗澡美容 · 小型犬",
    time: "周六 13:00–15:00",
    location: "普陀区长寿路 · 3.4km",
    price: "¥168/次",
    budget: "预算 ¥150–200",
    applicants: "1人报名",
    owner: "周先生",
    avatar: "/static/main/owner-4.jpg",
    urgent: false,
  },
] as const;

const mode = ref<"list" | "map">("list");

onLoad((query = {}) => {
  mode.value = getBountyMode(query);
});

function openPublish() {
  uni.navigateTo({ url: "/pages-bounty/publish/step1" });
}

function openReward(id: string) {
  uni.navigateTo({ url: `/pages-bounty/reward/detail?id=${encodeURIComponent(id)}` });
}
</script>

<template>
  <MainTabLayout active="bounty">
    <view class="box-border flex flex-col pb-screen">
      <view class="h-header flex items-center px-action">
        <text class="page-heading">悬赏大厅</text>
      </view>

      <view class="mx-action flex flex-col gap-copy main-card p-copy">
        <view class="h-control flex items-center gap-sm rounded-control bg-divider px-copy">
          <image class="h-icon-sm w-icon-sm" src="/static/main/search.svg" mode="aspectFit" />
          <text class="text-body text-subtle leading-body">搜索服务、宠物或区域</text>
        </view>

        <view class="h-segment flex rounded-control bg-divider p-caption">
          <view
            class="flex flex-1 items-center justify-center rounded-chip"
            :class="mode === 'list' ? 'bg-surface shadow-card' : ''"
            @click="mode = 'list'"
          >
            <text
              class="text-body font-medium leading-label"
              :class="mode === 'list' ? 'text-brand' : 'text-muted'"
            >
              列表
            </text>
          </view>
          <view
            class="flex flex-1 items-center justify-center rounded-chip"
            :class="mode === 'map' ? 'bg-surface shadow-card' : ''"
            @click="mode = 'map'"
          >
            <text
              class="text-body font-medium leading-label"
              :class="mode === 'map' ? 'text-brand' : 'text-muted'"
            >
              地图
            </text>
          </view>
        </view>

        <scroll-view class="w-full" scroll-x :show-scrollbar="false">
          <view class="flex gap-sm">
            <view
              v-for="(filter, index) in filters"
              :key="filter"
              class="shrink-0 rounded-pill px-copy py-sm"
              :class="index === 0 ? 'bg-brand' : 'border border-border bg-surface'"
            >
              <text
                class="whitespace-nowrap text-caption leading-caption"
                :class="index === 0 ? 'text-surface' : 'text-muted'"
              >
                {{ filter }}
              </text>
            </view>
          </view>
        </scroll-view>

        <view class="flex items-center justify-between border-t border-divider pt-copy">
          <text class="text-caption text-muted leading-caption">附近 42 个悬赏</text>
          <view class="flex items-center gap-caption">
            <text class="text-caption text-ink leading-caption">距离优先</text>
            <image
              class="h-icon-xs w-icon-xs rotate-90"
              src="/static/main/chevron.svg"
              mode="aspectFit"
            />
          </view>
        </view>
      </view>

      <view v-if="mode === 'list'" class="mx-action mt-copy flex flex-col gap-copy">
        <view
          v-for="item in bounties"
          :key="item.pet"
          class="main-card p-copy"
          hover-class="opacity-80"
          @click="openReward(item.id)"
        >
          <view class="flex gap-copy">
            <view
              class="relative h-card-cover w-card-cover shrink-0 overflow-hidden rounded-control"
            >
              <image class="h-full w-full" :src="item.image" mode="aspectFill" />
              <view
                v-if="item.urgent"
                class="absolute left-caption top-caption rounded-badge bg-danger px-compact py-xxs"
              >
                <text class="text-micro text-surface font-medium leading-micro">急</text>
              </view>
            </view>

            <view class="min-w-0 flex flex-1 flex-col">
              <view class="flex items-start justify-between gap-sm">
                <text class="truncate card-heading">{{ item.pet }}</text>
                <text class="shrink-0 text-amount text-danger font-semibold leading-card">
                  {{ item.price }}
                </text>
              </view>
              <text class="mt-caption meta-text">{{ item.service }}</text>
              <view class="mt-sm flex items-center gap-caption">
                <image class="h-icon-xs w-icon-xs" src="/static/main/time.svg" mode="aspectFit" />
                <text class="truncate quiet-text">{{ item.time }}</text>
              </view>
              <view class="mt-caption flex items-center gap-caption">
                <image
                  class="h-icon-xs w-icon-xs"
                  src="/static/main/bounty-location.svg"
                  mode="aspectFit"
                />
                <text class="truncate quiet-text">{{ item.location }}</text>
              </view>
            </view>
          </view>

          <view class="mt-copy flex items-center justify-between border-t border-divider pt-copy">
            <view class="flex items-center gap-sm">
              <image
                class="h-avatar-sm w-avatar-sm rounded-full"
                :src="item.avatar"
                mode="aspectFill"
              />
              <view class="flex flex-col">
                <text class="text-small text-ink font-medium leading-small">{{ item.owner }}</text>
                <text class="text-micro text-success leading-micro">信用良好</text>
              </view>
            </view>
            <view class="flex flex-col items-end">
              <text class="text-caption text-muted leading-caption">{{ item.applicants }}</text>
              <text class="text-micro text-subtle leading-micro">{{ item.budget }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="mx-action mt-copy flex flex-col gap-copy">
        <view
          class="h-hero flex flex-col justify-between rounded-card from-soft to-divider bg-gradient-to-br p-action shadow-card"
        >
          <view class="flex justify-between">
            <view class="rounded-pill bg-surface px-copy py-sm shadow-card">
              <text class="text-caption text-brand font-semibold leading-caption">¥58</text>
            </view>
            <view class="rounded-pill bg-brand px-copy py-sm shadow-card">
              <text class="text-caption text-surface font-semibold leading-caption">¥68</text>
            </view>
          </view>
          <view class="flex justify-center">
            <view class="rounded-pill bg-surface px-copy py-sm shadow-card">
              <text class="text-caption text-danger font-semibold leading-caption">¥76</text>
            </view>
          </view>
          <view class="flex items-center gap-sm rounded-control bg-surface p-copy shadow-card">
            <image
              class="h-icon-sm w-icon-sm"
              src="/static/main/bounty-location.svg"
              mode="aspectFit"
            />
            <text class="text-caption text-muted leading-caption">
              当前为静态地图预览，未请求定位权限
            </text>
          </view>
        </view>

        <view class="main-card p-copy" hover-class="opacity-80" @click="openReward('reward-1')">
          <view class="flex gap-copy">
            <image
              class="h-card-cover w-card-cover shrink-0 rounded-control"
              src="/static/main/community-pet-1.jpg"
              mode="aspectFill"
            />
            <view class="min-w-0 flex flex-1 flex-col justify-between">
              <view>
                <view class="flex items-start justify-between gap-sm">
                  <text class="truncate card-heading">咪咪 · 英国蓝猫</text>
                  <text class="shrink-0 text-amount text-danger font-semibold leading-card">
                    ¥68/次
                  </text>
                </view>
                <text class="mt-caption meta-text">上门喂养 · 2次</text>
                <text class="mt-sm block quiet-text">静安区悦庭花园 · 1.2km</text>
              </view>
              <text class="text-caption text-brand font-medium leading-caption">查看悬赏详情</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <template #floating>
      <view
        class="pointer-events-auto h-fab w-fab flex items-center justify-center rounded-full bg-brand shadow-float"
        aria-label="发布悬赏"
        @click="openPublish"
      >
        <image class="h-glyph w-glyph" src="/static/main/plus.svg" mode="aspectFit" />
      </view>
    </template>
  </MainTabLayout>
</template>
