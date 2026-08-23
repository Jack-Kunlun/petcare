<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const tabs = ["照护者", "店铺", "创作者"] as const;
const follows = [
  {
    kind: "照护者",
    name: "小林",
    detail: "实名认证 · 4.9分 · 已服务128次",
    image: "/static/main/owner-1.jpg",
    route: "/pages-account/caregivers/detail?id=caregiver-1",
  },
  {
    kind: "店铺",
    name: "PetCare 静安服务站",
    detail: "洗护美容 · 寄养 · 1.2km",
    image: "/static/main/home-hero-trusted.png",
    route: "/pages-account/stores/detail?id=store-1",
  },
  {
    kind: "创作者",
    name: "栗子妈妈",
    detail: "猫咪护理创作者 · 1.8万粉丝",
    image: "/static/main/owner-5.jpg",
    route: "/pages-account/creators/detail?id=creator-1",
  },
] as const;

function openPage(route: string) {
  uni.navigateTo({ url: route });
}
</script>

<template>
  <SubPageLayout title="我的关注">
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
        v-for="item in follows"
        :key="item.kind"
        class="flex items-center gap-copy main-card p-action"
        hover-class="opacity-80"
        @click="openPage(item.route)"
      >
        <image class="h-avatar-lg w-avatar-lg rounded-full" :src="item.image" mode="aspectFill" />
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="text-caption text-brand leading-caption">{{ item.kind }}</text>
          <text class="mt-caption card-heading">{{ item.name }}</text>
          <text class="mt-caption truncate quiet-text">{{ item.detail }}</text>
        </view>
        <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
      </view>
    </view>
  </SubPageLayout>
</template>
