<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import type { MiniappUserProfile } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { getProfile } from "@/api/user";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";
import {
  captureSessionUserRevision,
  isSessionUserRevisionCurrent,
  session,
  updateSessionUser,
} from "@/state/session";

const profile = ref<MiniappUserProfile | null>(session.user);
const status = ref<"loading" | "ready" | "error" | "unauthenticated">(
  profile.value ? "ready" : "loading",
);
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
  if (!session.user) {
    profile.value = null;
    status.value = session.bootstrapped ? "unauthenticated" : "loading";
    errorMessage.value = "";

    return;
  }

  if (loading.value) {
    return;
  }

  loading.value = true;

  if (!profile.value) {
    status.value = "loading";
  }

  errorMessage.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getProfile();

    if (updateSessionUser(response, startedAt)) {
      profile.value = response;
      status.value = "ready";
    } else if (!isSessionUserRevisionCurrent(startedAt)) {
      profile.value = null;
      status.value = "unauthenticated";
    }
  } catch {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      profile.value = null;
      status.value = "unauthenticated";
    } else if (profile.value) {
      status.value = "ready";
      errorMessage.value = "个人资料刷新失败，当前资料仍可查看";
    } else {
      status.value = "error";
      errorMessage.value = "个人资料加载失败，请重试";
    }
  } finally {
    loading.value = false;
  }
}

onShow(() => void loadProfile());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void loadProfile();
    }
  },
);

function editProfile() {
  uni.navigateTo({ url: "/pages-account/profile/edit" });
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}
</script>

<template>
  <SubPageLayout title="个人信息">
    <view class="flex flex-col gap-copy px-action py-card">
      <PcStatePanel v-if="status === 'loading'" status="loading" title="个人资料加载中…" />

      <PcStatePanel
        v-else-if="status === 'unauthenticated'"
        status="unauthenticated"
        title="登录后查看个人资料"
        description="登录后可查看并编辑自己的资料。"
        primary-label="微信登录"
        @primary="openLogin"
      />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="个人资料加载失败"
        description="请稍后重试，成功后会在此显示资料。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="loadProfile"
      />

      <template v-else-if="status === 'ready' && profile">
        <view class="flex flex-col items-center main-card p-card">
          <image class="h-avatar-lg w-avatar-lg rounded-full" :src="avatarUrl" mode="aspectFill" />
          <text class="mt-copy card-heading">{{ profile.nickname }}</text>
          <text
            class="mt-caption text-caption leading-caption"
            :class="profile.profileComplete ? 'text-success' : 'text-muted'"
          >
            {{ profile.profileComplete ? "手机号已完善" : "手机号未完善" }}
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

        <view
          v-if="errorMessage"
          class="flex items-center justify-between gap-copy rounded-control bg-divider p-copy"
          role="status"
        >
          <text class="min-w-0 flex-1 text-caption text-muted leading-caption">{{
            errorMessage
          }}</text>
          <PcButton variant="ghost" :disabled="loading" @click="loadProfile">刷新</PcButton>
        </view>
      </template>
    </view>

    <template #actions>
      <PcButton v-if="status === 'ready' && profile" block size="action" @click="editProfile">
        编辑个人信息
      </PcButton>
    </template>
  </SubPageLayout>
</template>
