<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const serviceId = ref("service-1");
const flow = ["确认宠物与地址", "照护者按时到达", "完成服务并上传记录", "主人在线验收"] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    serviceId.value = query.id;
  }
});

function openCaregiver() {
  uni.navigateTo({ url: "/pages-account/caregivers/detail?id=caregiver-1" });
}

function openChat() {
  uni.navigateTo({ url: "/pages-care/chat/index?userId=caregiver-1" });
}
</script>

<template>
  <SubPageLayout title="服务详情">
    <view class="flex flex-col gap-copy pb-card">
      <image
        class="h-hero-main w-full"
        src="/static/main/home-hero-trusted.png"
        mode="aspectFill"
      />
      <view class="mx-action main-card p-action -mt-surface-overlap">
        <view class="flex items-start justify-between gap-copy">
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="page-heading">安心上门喂养</text>
            <text class="mt-caption meta-text">适合猫咪与小型宠物 · {{ serviceId }}</text>
          </view>
          <text class="text-amount text-danger font-semibold leading-card">¥68起</text>
        </view>
        <view class="mt-action flex gap-sm">
          <view class="rounded-pill bg-warning-soft px-copy py-caption">
            <text class="text-caption text-warning leading-caption">4.9分</text>
          </view>
          <view class="rounded-pill bg-success-soft px-copy py-caption">
            <text class="text-caption text-success leading-caption">已服务128次</text>
          </view>
        </view>
      </view>

      <view class="mx-action main-card p-action">
        <text class="card-heading">服务流程</text>
        <view class="mt-copy flex flex-col gap-copy">
          <view v-for="(item, index) in flow" :key="item" class="flex items-center gap-copy">
            <view
              class="h-icon-sm w-icon-sm flex items-center justify-center rounded-full bg-soft text-caption text-brand"
            >
              {{ index + 1 }}
            </view>
            <text class="meta-text">{{ item }}</text>
          </view>
        </view>
      </view>

      <view class="mx-action flex gap-copy">
        <view class="min-w-0 flex flex-1 flex-col main-card p-action">
          <text class="card-heading">包含项目</text>
          <text class="mt-copy meta-text">补充粮水、清洁餐具、清理猫砂、照片记录</text>
        </view>
        <view class="min-w-0 flex flex-1 flex-col main-card p-action">
          <text class="card-heading">不含项目</text>
          <text class="mt-copy meta-text">医疗护理、特殊药物注射、宠物接送</text>
        </view>
      </view>

      <view
        class="mx-action flex items-center gap-copy main-card p-action"
        hover-class="opacity-80"
        @click="openCaregiver"
      >
        <image
          class="h-avatar w-avatar rounded-full"
          src="/static/main/owner-1.jpg"
          mode="aspectFill"
        />
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="card-heading">服务者 · 小林</text>
          <text class="mt-caption text-caption text-success leading-caption"
            >实名认证 · 信用良好</text
          >
        </view>
        <image class="h-icon-xs w-icon-xs" src="/static/main/chevron.svg" mode="aspectFit" />
      </view>
    </view>

    <template #actions>
      <view class="flex gap-copy">
        <view
          class="h-button flex flex-1 items-center justify-center border border-brand rounded-control bg-surface"
          @click="openChat"
        >
          <text class="text-body text-brand font-medium leading-label">咨询照护者</text>
        </view>
        <view
          class="h-button flex flex-1 items-center justify-center rounded-control bg-brand opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-surface font-medium leading-label">立即预约</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
