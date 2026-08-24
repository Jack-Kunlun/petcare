<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import type { MiniappUserProfile } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getProfile } from "@/api/user";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";
import { session, updateSessionUser } from "@/state/session";

const profile = ref<MiniappUserProfile | null>(session.user);
const loading = ref(false);
const errorMessage = ref("");
const avatarUrl = computed(() => {
  const user = profile.value;

  return user ? (user.avatar ?? getDefaultAvatar(user.id)) : "/static/main/profile-cat.png";
});
const fields = computed(() => {
  const user = profile.value;

  return user
    ? [
        { label: "昵称", value: user.nickname },
        { label: "手机号", value: user.phoneMasked ?? "未绑定" },
        { label: "所在地区", value: user.region ?? "未填写" },
        { label: "个人简介", value: user.bio ?? "未填写" },
      ]
    : [];
});

async function loadProfile() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    profile.value = await getProfile();
    updateSessionUser(profile.value);
  } catch {
    errorMessage.value = "个人资料加载失败，请重试";
  } finally {
    loading.value = false;
  }
}

onShow(() => void loadProfile());

function editProfile() {
  uni.navigateTo({ url: "/pages-account/profile/edit" });
}
</script>

<template>
  <SubPageLayout title="个人信息">
    <view class="flex flex-col gap-copy px-action py-card">
      <view v-if="profile" class="flex flex-col items-center main-card p-card">
        <image class="h-avatar-lg w-avatar-lg rounded-full" :src="avatarUrl" mode="aspectFill" />
        <text class="mt-copy card-heading">{{ profile.nickname }}</text>
        <text
          class="mt-caption text-caption leading-caption"
          :class="profile.profileComplete ? 'text-success' : 'text-warning'"
        >
          {{ profile.profileComplete ? "手机号已完善" : "手机号未完善" }}
        </text>
      </view>

      <view v-if="profile" class="overflow-hidden main-card">
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

      <view v-else class="flex flex-col items-center gap-copy main-card p-card">
        <text class="text-body text-muted leading-body">
          {{ loading ? "正在加载个人资料…" : "暂无个人资料" }}
        </text>
      </view>

      <view v-if="errorMessage" class="flex flex-col items-center gap-copy main-card p-card">
        <text class="text-caption text-danger leading-caption">{{ errorMessage }}</text>
        <button
          class="h-control rounded-control bg-brand px-action text-surface"
          :class="loading ? 'opacity-50' : ''"
          :disabled="loading"
          @click="loadProfile"
        >
          重试
        </button>
      </view>
    </view>

    <template #actions>
      <button
        class="h-button flex items-center justify-center rounded-control bg-brand"
        :class="!profile ? 'opacity-50' : ''"
        :disabled="!profile"
        @click="editProfile"
      >
        <text class="text-button text-surface font-semibold leading-button">编辑个人信息</text>
      </button>
    </template>
  </SubPageLayout>
</template>
