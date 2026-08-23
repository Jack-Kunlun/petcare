<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const services = ["上门喂养", "遛狗", "洗护美容", "寄养"] as const;

function next() {
  uni.navigateTo({ url: "/pages-bounty/publish/step2" });
}
</script>

<template>
  <SubPageLayout title="发布悬赏">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col gap-sm">
        <view class="flex items-center justify-between">
          <text class="text-caption text-brand font-medium leading-caption">步骤 1/3</text>
          <text class="quiet-text">选择服务类型</text>
        </view>
        <view class="h-progress overflow-hidden rounded-pill bg-divider">
          <view class="h-full w-1/3 rounded-pill bg-brand" />
        </view>
      </view>

      <view>
        <text class="section-heading">需要什么照护？</text>
        <text class="mt-caption block meta-text">选择最符合本次需求的服务类型</text>
      </view>

      <view class="grid grid-cols-2 gap-copy">
        <view
          v-for="(service, index) in services"
          :key="service"
          class="h-actions flex flex-col items-center justify-center gap-sm border rounded-card p-copy"
          :class="index === 0 ? 'border-brand bg-soft' : 'border-border bg-surface'"
        >
          <image class="h-glyph w-glyph" src="/static/main/heart.svg" mode="aspectFit" />
          <text
            class="text-body font-medium leading-label"
            :class="index === 0 ? 'text-brand' : 'text-ink'"
          >
            {{ service }}
          </text>
        </view>
      </view>

      <view class="rounded-card bg-warning-soft p-action">
        <text class="text-body text-ink font-medium leading-label">上门喂养包含</text>
        <text class="mt-sm block meta-text">补充粮水、清理餐具与猫砂，并上传服务记录。</text>
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="next"
      >
        <text class="text-button text-surface font-semibold leading-button">下一步</text>
      </view>
    </template>
  </SubPageLayout>
</template>
