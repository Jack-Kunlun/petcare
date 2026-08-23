<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const caregiverId = ref("caregiver-1");
const tags = ["猫咪照护", "大型犬遛护", "老年宠物", "基础急救"] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    caregiverId.value = query.id;
  }
});

function openService() {
  uni.navigateTo({ url: "/pages-account/services/detail?id=service-1" });
}

function openChat() {
  uni.navigateTo({ url: "/pages-care/chat/index?userId=caregiver-1" });
}
</script>

<template>
  <SubPageLayout title="照护者详情">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="flex flex-col items-center main-card p-card">
        <image
          class="h-card-cover w-card-cover rounded-full"
          src="/static/main/owner-1.jpg"
          mode="aspectFill"
        />
        <text class="mt-copy page-heading">小林</text>
        <text class="mt-caption meta-text">{{ caregiverId }} · 静安区 · 1.2km</text>
        <view class="mt-copy flex gap-sm">
          <view class="rounded-pill bg-success-soft px-copy py-caption">
            <text class="text-caption text-success leading-caption">实名认证</text>
          </view>
          <view class="rounded-pill bg-warning-soft px-copy py-caption">
            <text class="text-caption text-warning leading-caption">4.9分</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">自我介绍</text>
        <text class="mt-copy block meta-text">
          有 5 年养宠经验，熟悉猫咪和中大型犬日常照护，会按约定完整记录每个服务节点。
        </text>
        <view class="mt-action flex flex-wrap gap-sm">
          <view v-for="tag in tags" :key="tag" class="rounded-pill bg-soft px-copy py-caption">
            <text class="text-caption text-brand leading-caption">{{ tag }}</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action" hover-class="opacity-80" @click="openService">
        <view class="flex items-center justify-between">
          <text class="card-heading">安心上门喂养</text>
          <text class="text-amount text-danger font-semibold leading-card">¥68起</text>
        </view>
        <text class="mt-caption block meta-text">30–60分钟 · 上传完整照护记录</text>
      </view>

      <view class="main-card p-action">
        <view class="flex items-center justify-between">
          <text class="card-heading">服务评价</text>
          <text class="text-caption text-brand leading-caption">共 86 条</text>
        </view>
        <text class="mt-copy block meta-text">“特别耐心，咪咪第一次见他就愿意靠近。”</text>
        <text class="mt-sm block quiet-text">郑先生 · 2026-08-18</text>
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="openChat"
      >
        <text class="text-button text-surface font-semibold leading-button">联系小林</text>
      </view>
    </template>
  </SubPageLayout>
</template>
