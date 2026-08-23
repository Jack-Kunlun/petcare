<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const reviews = [
  {
    name: "小林",
    role: "我收到的评价",
    text: "沟通顺畅，咪咪很亲近他，服务记录也很完整。",
    time: "2026-08-18",
    image: "/static/main/owner-1.jpg",
  },
  {
    name: "林女士",
    role: "我给出的评价",
    text: "宠物信息清楚，地址和注意事项描述得很准确。",
    time: "2026-08-12",
    image: "/static/main/owner-3.jpg",
  },
  {
    name: "PetCare 静安服务站",
    role: "我收到的评价",
    text: "按时到店，沟通友善，感谢信任我们的洗护服务。",
    time: "2026-08-06",
    image: "/static/main/home-hero-trusted.png",
  },
] as const;
</script>

<template>
  <SubPageLayout title="我的评价">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="flex main-card p-action">
        <view class="flex flex-1 flex-col items-center border-r border-divider">
          <text class="text-amount text-brand font-semibold leading-card">4.9</text>
          <text class="quiet-text">收到 18 条</text>
        </view>
        <view class="flex flex-1 flex-col items-center">
          <text class="text-amount text-ink font-semibold leading-card">12</text>
          <text class="quiet-text">给出评价</text>
        </view>
      </view>

      <view v-for="review in reviews" :key="review.time" class="main-card p-action">
        <view class="flex items-center gap-copy">
          <image class="h-avatar w-avatar rounded-full" :src="review.image" mode="aspectFill" />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-body text-ink font-semibold leading-label">{{ review.name }}</text>
            <text class="mt-caption quiet-text">{{ review.role }} · {{ review.time }}</text>
          </view>
          <text class="text-caption text-warning leading-caption">5.0分</text>
        </view>
        <text class="mt-action block text-body text-ink leading-body">{{ review.text }}</text>
      </view>
    </view>
  </SubPageLayout>
</template>
