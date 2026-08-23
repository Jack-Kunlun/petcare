<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const fields = [
  { label: "服务宠物", value: "咪咪 · 英国短毛猫" },
  { label: "服务日期", value: "2026年8月24日" },
  { label: "时间段", value: "14:00–16:00" },
  { label: "服务地址", value: "上海市静安区悦庭花园" },
  { label: "补充说明", value: "进门前先联系，咪咪怕生，请轻声靠近。" },
] as const;

function next() {
  uni.navigateTo({ url: "/pages-bounty/publish/step3" });
}
</script>

<template>
  <SubPageLayout title="填写需求">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col gap-sm">
        <view class="flex items-center justify-between">
          <text class="text-caption text-brand font-medium leading-caption">步骤 2/3</text>
          <text class="quiet-text">完善服务信息</text>
        </view>
        <view class="h-progress overflow-hidden rounded-pill bg-divider">
          <view class="h-full w-2/3 rounded-pill bg-brand" />
        </view>
      </view>

      <view class="overflow-hidden main-card">
        <view
          v-for="(field, index) in fields"
          :key="field.label"
          class="flex items-start gap-action px-action py-action"
          :class="index < fields.length - 1 ? 'border-b border-divider' : ''"
        >
          <text class="w-pet shrink-0 text-body text-muted leading-label">{{ field.label }}</text>
          <text class="min-w-0 flex-1 text-right text-body text-ink leading-body">
            {{ field.value }}
          </text>
        </view>
      </view>

      <view class="rounded-card bg-soft p-action">
        <text class="meta-text">当前为静态预览，日期、地址与说明不会保存。</text>
      </view>
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="next"
      >
        <text class="text-button text-surface font-semibold leading-button">确认信息</text>
      </view>
    </template>
  </SubPageLayout>
</template>
