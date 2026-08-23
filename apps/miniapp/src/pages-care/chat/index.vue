<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const userId = ref("caregiver-1");

onLoad((query = {}) => {
  if (typeof query.userId === "string" && query.userId) {
    userId.value = query.userId;
  }
});
</script>

<template>
  <SubPageLayout title="小林">
    <view class="flex flex-col gap-action px-action py-card">
      <text class="self-center quiet-text">今天 10:28 · {{ userId }}</text>
      <view class="flex items-end gap-sm">
        <image
          class="h-avatar-sm w-avatar-sm rounded-full"
          src="/static/main/owner-1.jpg"
          mode="aspectFill"
        />
        <view class="max-w-agreement rounded-card bg-surface p-copy shadow-card">
          <text class="text-body text-ink leading-body">您好，我会在 12:30 左右到达。</text>
        </view>
      </view>
      <view class="max-w-agreement self-end rounded-card bg-brand p-copy">
        <text class="text-body text-surface leading-body">好的，进门前麻烦先联系我。</text>
      </view>
      <text class="self-center quiet-text">10:32</text>
      <view class="flex items-end gap-sm">
        <image
          class="h-avatar-sm w-avatar-sm rounded-full"
          src="/static/main/owner-1.jpg"
          mode="aspectFill"
        />
        <view class="max-w-agreement rounded-card bg-surface p-copy shadow-card">
          <text class="text-body text-ink leading-body">收到，到达后我会先上传现场照片。</text>
        </view>
      </view>
    </view>

    <template #actions>
      <view class="flex gap-sm">
        <view
          class="h-control flex flex-1 items-center rounded-control bg-divider px-copy opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-subtle leading-label">静态页面暂不可输入</text>
        </view>
        <view
          class="h-control flex items-center justify-center rounded-control bg-brand px-action opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-surface font-medium leading-label">发送</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
