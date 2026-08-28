<script setup lang="ts">
import { computed, ref } from "vue";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { runLogoutFlow } from "@/pages/profile/logout";
import { logout, session } from "@/state/session";

const logoutPending = ref(false);
const profile = computed(() => session.user);

function openPage(route: string): void {
  uni.navigateTo({ url: route });
}

function openCancellation(): void {
  if (!profile.value || logoutPending.value) {
    return;
  }

  uni.navigateTo({ url: "/pages-account/account/cancel" });
}

async function logoutCurrentDevice(): Promise<void> {
  if (!profile.value) {
    return;
  }

  await runLogoutFlow(logoutPending, {
    logout,
    reLaunch: (options) => uni.reLaunch(options),
    showToast: (options) => uni.showToast(options),
  });
}
</script>

<template>
  <SubPageLayout title="设置">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel v-if="!session.bootstrapped" status="loading" title="设置加载中…" />

      <PcStatePanel
        v-else-if="!profile"
        status="unauthenticated"
        title="登录后管理账号安全"
        description="登录后可查看账号安全设置，退出或注销操作不会对匿名状态生效。"
        primary-label="微信登录"
        @primary="openPage('/pages/auth/index')"
      />

      <template v-else>
        <view class="flex flex-col gap-copy rounded-card bg-surface p-action shadow-card">
          <text class="section-heading">账号与安全</text>
          <text class="text-body text-muted leading-body">
            管理个人资料、手机号与当前设备的登录状态。
          </text>
          <PcButton
            block
            variant="secondary"
            aria-label="编辑个人信息"
            @click="openPage('/pages-account/profile/edit')"
          >
            编辑个人信息
          </PcButton>
        </view>

        <view class="flex flex-col gap-copy rounded-card bg-surface p-action shadow-card">
          <text class="card-heading">当前账号</text>
          <view class="flex items-center justify-between gap-copy">
            <text class="text-body text-muted leading-body">登录账号</text>
            <text class="min-w-0 flex-1 truncate text-right text-body text-ink leading-body">
              {{ profile.nickname }}
            </text>
          </view>
          <PcButton
            block
            variant="secondary"
            :loading="logoutPending"
            :disabled="logoutPending"
            aria-label="退出登录"
            @click="logoutCurrentDevice"
          >
            {{ logoutPending ? "退出中…" : "退出登录" }}
          </PcButton>
          <PcButton
            block
            variant="danger"
            :disabled="logoutPending"
            aria-label="注销账号"
            @click="openCancellation"
          >
            注销账号
          </PcButton>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
