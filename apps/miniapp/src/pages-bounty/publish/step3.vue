<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const summary = [
  { label: "服务类型", value: "上门喂养 · 2次" },
  { label: "宠物", value: "咪咪 · 英国短毛猫" },
  { label: "时间", value: "8月24日 14:00–16:00" },
  { label: "地址", value: "静安区悦庭花园" },
  { label: "预算", value: "¥50–80/次" },
] as const;

function publish() {
  uni.navigateTo({ url: "/pages-bounty/publish/success" });
}
</script>

<template>
  <SubPageLayout title="确认发布">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col gap-sm">
        <view class="flex items-center justify-between">
          <text class="text-caption text-brand font-medium leading-caption">步骤 3/3</text>
          <text class="quiet-text">核对悬赏内容</text>
        </view>
        <view class="h-progress overflow-hidden rounded-pill bg-divider">
          <view class="h-full w-full rounded-pill bg-brand" />
        </view>
      </view>

      <view class="overflow-hidden main-card">
        <view
          v-for="(item, index) in summary"
          :key="item.label"
          class="flex items-center justify-between gap-action px-action py-copy"
          :class="index < summary.length - 1 ? 'border-b border-divider' : ''"
        >
          <text class="text-body text-muted leading-label">{{ item.label }}</text>
          <text class="min-w-0 flex-1 text-right text-body text-ink font-medium leading-label">
            {{ item.value }}
          </text>
        </view>
      </view>

      <view class="flex items-start gap-sm rounded-card bg-surface p-action shadow-card">
        <image
          class="mt-caption h-icon-sm w-icon-sm"
          src="/static/main/check.svg"
          mode="aspectFit"
        />
        <text class="min-w-0 flex-1 text-body text-muted leading-body">
          我已阅读并同意服务协议，了解当前页面仅展示静态发布流程。
        </text>
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="publish"
      >
        <text class="text-button text-surface font-semibold leading-button">发布悬赏</text>
      </view>
    </template>
  </SubPageLayout>
</template>
