<script setup lang="ts">
import { profileFixture } from "../fixtures";
import SubPageLayout from "@/components/SubPageLayout.vue";

const fields = [
  { label: "昵称", value: profileFixture.name },
  { label: "手机号", value: profileFixture.phone },
  { label: "所在地区", value: profileFixture.city },
  { label: "个人简介", value: profileFixture.bio },
] as const;

function editProfile() {
  uni.navigateTo({ url: "/pages-account/profile/edit" });
}
</script>

<template>
  <SubPageLayout title="个人信息">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="flex flex-col items-center main-card p-card">
        <view
          class="h-avatar-lg w-avatar-lg flex items-center justify-center rounded-full bg-brand text-card text-surface font-semibold"
        >
          郑
        </view>
        <text class="mt-copy card-heading">{{ profileFixture.name }}</text>
        <text class="mt-caption text-caption text-success leading-caption">
          PetCare 信用 {{ profileFixture.credit }} · 信用良好
        </text>
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
        @click="editProfile"
      >
        <text class="text-button text-surface font-semibold leading-button">编辑个人信息</text>
      </view>
    </template>
  </SubPageLayout>
</template>
