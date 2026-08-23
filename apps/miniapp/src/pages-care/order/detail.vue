<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const orderId = ref("order-1");
const timeline = ["订单已确认", "照护者已到达", "完成首次喂食", "等待下一次上门"] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    orderId.value = query.id;
  }
});

function openMonitor() {
  uni.navigateTo({ url: `/pages-care/monitor/index?orderId=${encodeURIComponent(orderId.value)}` });
}

function openChat() {
  uni.navigateTo({ url: "/pages-care/chat/index?userId=caregiver-1" });
}
</script>

<template>
  <SubPageLayout title="订单详情">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="rounded-card from-brand to-brand-active bg-gradient-to-r p-action text-surface">
        <text class="text-section font-semibold leading-section">服务进行中</text>
        <text class="mt-caption block text-caption leading-caption">订单 {{ orderId }}</text>
        <view class="mt-action h-progress overflow-hidden rounded-pill bg-surface opacity-80">
          <view class="h-full w-2/3 rounded-pill bg-success" />
        </view>
        <text class="mt-sm block text-caption leading-caption">已完成 65%，预计 18:00 完成</text>
      </view>

      <view class="main-card p-action">
        <view class="flex gap-copy">
          <image
            class="h-pet w-pet rounded-control"
            src="/static/main/profile-cat.png"
            mode="aspectFill"
          />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="card-heading">咪咪 · 英国短毛猫</text>
            <text class="mt-caption meta-text">上门喂养 · 2次</text>
            <text class="mt-sm quiet-text">今天 12:30–18:00</text>
          </view>
        </view>
        <view class="mt-action flex items-center gap-sm border-t border-divider pt-action">
          <image
            class="h-icon-xs w-icon-xs"
            src="/static/main/bounty-location.svg"
            mode="aspectFit"
          />
          <text class="meta-text">上海市静安区悦庭花园</text>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">服务照护者</text>
        <view class="mt-copy flex items-center gap-copy">
          <image
            class="h-avatar w-avatar rounded-full"
            src="/static/main/owner-1.jpg"
            mode="aspectFill"
          />
          <view class="flex flex-1 flex-col">
            <text class="text-body text-ink font-semibold leading-label">小林</text>
            <text class="mt-caption text-caption text-success leading-caption"
              >实名认证 · 4.9分</text
            >
          </view>
          <text class="quiet-text">已服务 128 次</text>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">服务进度</text>
        <view class="mt-copy flex flex-col gap-copy">
          <view v-for="(item, index) in timeline" :key="item" class="flex items-center gap-copy">
            <view
              class="h-icon-sm w-icon-sm flex items-center justify-center rounded-full"
              :class="index < 3 ? 'bg-success-soft' : 'bg-divider'"
            >
              <image class="h-icon-xs w-icon-xs" src="/static/main/check.svg" mode="aspectFit" />
            </view>
            <text :class="index < 3 ? 'meta-text' : 'quiet-text'">{{ item }}</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <view class="flex items-center justify-between">
          <text class="card-heading">照护记录</text>
          <text class="text-caption text-brand leading-caption">3 条</text>
        </view>
        <view class="mt-copy flex gap-sm">
          <image
            v-for="image in [
              '/static/main/community-pet-1.jpg',
              '/static/main/community-pet-3.jpg',
            ]"
            :key="image"
            class="h-card-cover min-w-0 flex-1 rounded-control"
            :src="image"
            mode="aspectFill"
          />
        </view>
      </view>

      <view class="main-card p-action">
        <view class="flex justify-between">
          <text class="meta-text">服务费</text>
          <text class="text-body text-ink leading-label">¥136</text>
        </view>
        <view class="mt-copy flex justify-between border-t border-divider pt-copy">
          <text class="card-heading">实付金额</text>
          <text class="text-amount text-danger font-semibold leading-card">¥136</text>
        </view>
      </view>
    </view>

    <template #actions>
      <view class="flex gap-copy">
        <view
          class="h-button flex flex-1 items-center justify-center border border-brand rounded-control bg-surface"
          @click="openChat"
        >
          <text class="text-body text-brand font-medium leading-label">联系照护者</text>
        </view>
        <view
          class="h-button flex flex-1 items-center justify-center rounded-control bg-brand"
          @click="openMonitor"
        >
          <text class="text-body text-surface font-medium leading-label">查看实时记录</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
