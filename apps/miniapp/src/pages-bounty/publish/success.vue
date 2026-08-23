<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

function finish() {
  uni.switchTab({ url: "/pages/bounty/index" });
}
</script>

<template>
  <SubPageLayout title="发布成功">
    <view class="flex flex-col items-center px-action py-section text-center">
      <view
        class="h-actions w-actions flex items-center justify-center rounded-full bg-success-soft"
      >
        <image class="h-icon-md w-icon-md" src="/static/main/check.svg" mode="aspectFit" />
      </view>
      <text class="mt-card page-heading">悬赏已发布</text>
      <text class="mt-sm meta-text">附近的照护者看到后即可报名</text>

      <view class="mt-section w-full main-card p-action text-left">
        <text class="card-heading">咪咪的上门喂养</text>
        <text class="mt-sm block meta-text">8月24日 14:00–16:00 · 静安区悦庭花园</text>
        <view class="mt-action flex items-center justify-between border-t border-divider pt-action">
          <text class="meta-text">预算</text>
          <text class="text-amount text-danger font-semibold leading-card">¥50–80/次</text>
        </view>
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="finish"
      >
        <text class="text-button text-surface font-semibold leading-button">返回悬赏大厅</text>
      </view>
    </template>
  </SubPageLayout>
</template>
