<script setup lang="ts">
import { profileFixture } from "../fixtures";
import SubPageLayout from "@/components/SubPageLayout.vue";

const fields = [
  { label: "昵称", value: profileFixture.name },
  { label: "手机号", value: profileFixture.phone },
  { label: "所在地区", value: profileFixture.city },
  { label: "个人简介", value: profileFixture.bio },
] as const;

function save() {
  uni.navigateBack();
}
</script>

<template>
  <SubPageLayout title="编辑个人信息">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col items-center gap-sm">
        <view
          class="h-avatar-lg w-avatar-lg flex items-center justify-center rounded-full bg-brand text-card text-surface font-semibold"
        >
          郑
        </view>
        <text class="text-caption text-brand leading-caption">更换头像</text>
        <text class="quiet-text">静态预览不支持上传</text>
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
    </view>

    <template #actions>
      <view
        class="h-button flex items-center justify-center rounded-control bg-brand"
        @click="save"
      >
        <text class="text-button text-surface font-semibold leading-button">保存修改</text>
      </view>
    </template>
  </SubPageLayout>
</template>
