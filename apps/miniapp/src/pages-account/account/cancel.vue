<script setup lang="ts">
import { onUnload } from "@dcloudio/uni-app";
import { computed, reactive, ref } from "vue";
import {
  getCancellationRequirement,
  runCancellationCodeFlow,
  runCancellationFlow,
} from "./cancellation";
import type { CancellationFlowState } from "./cancellation";
import { cancelAccount, sendCancellationCode } from "@/api/user";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { completeCancellation, session } from "@/state/session";

const code = ref("");
const countdown = ref(0);
const flow = reactive<CancellationFlowState>({
  sending: false,
  cancelling: false,
  errorMessage: "",
});
const requirement = computed(() => getCancellationRequirement(session.user?.phoneMasked ?? null));
const busy = computed(() => flow.sending || flow.cancelling);
const sendDisabled = computed(() => busy.value || countdown.value > 0);
const cancelDisabled = computed(
  () =>
    !session.user || busy.value || (requirement.value.requiresCode && !/^\d{6}$/u.test(code.value)),
);
let active = true;
let countdownTimer: ReturnType<typeof setInterval> | undefined;

function startCountdown(): void {
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;

    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
  }, 1000);
}

function requestCode(): void {
  if (sendDisabled.value) {
    return;
  }

  void runCancellationCodeFlow(flow, requirement.value.requiresCode, {
    getCurrentUserId: () => session.user?.id ?? null,
    sendCancellationCode,
    startCountdown,
    showToast: (options) => uni.showToast(options),
    isActive: () => active,
  });
}

function requestCancellation(): void {
  if (cancelDisabled.value) {
    return;
  }

  void runCancellationFlow(
    flow,
    { requiresCode: requirement.value.requiresCode, code: code.value },
    {
      getCurrentUserId: () => session.user?.id ?? null,
      isActive: () => active,
      showModal: (options) => uni.showModal(options),
      cancelAccount,
      completeCancellation,
      showToast: (options) => uni.showToast(options),
      reLaunch: (options) => uni.reLaunch(options),
    },
  );
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function returnToSettings(): void {
  uni.redirectTo({ url: "/pages-account/account/settings" });
}

onUnload(() => {
  active = false;

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
});
</script>

<template>
  <SubPageLayout title="注销账户">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col gap-copy rounded-card bg-danger-soft p-action">
        <text class="text-section text-danger font-semibold leading-section">
          账户注销后不可恢复
        </text>
        <text class="text-body text-ink leading-body">所有设备上的登录会话将立即失效。</text>
        <text class="text-body text-ink leading-body">必要的安全与审计记录会按规则保留。</text>
        <text class="text-body text-ink leading-body"
          >存在受保护的关联数据时，系统会暂时拒绝注销。</text
        >
      </view>

      <PcStatePanel
        v-if="!session.user"
        status="unauthenticated"
        title="登录状态已失效"
        description="请重新登录后再管理账号。"
        primary-label="微信登录"
        secondary-label="返回设置"
        @primary="openLogin"
        @secondary="returnToSettings"
      />

      <view v-else class="flex flex-col gap-copy main-card p-action">
        <view v-if="requirement.requiresCode" class="flex flex-col gap-copy">
          <view class="flex items-center justify-between">
            <text class="text-body text-muted leading-label">验证手机号</text>
            <text class="text-body text-ink leading-label">{{ requirement.phoneLabel }}</text>
          </view>
          <text class="quiet-text">请先验证当前账户绑定的手机号</text>
          <view class="flex gap-sm">
            <input
              v-model="code"
              class="h-control min-w-0 flex-1 rounded-control bg-divider px-copy text-body text-ink"
              :class="busy ? 'opacity-50' : ''"
              type="number"
              :maxlength="6"
              :disabled="busy"
              placeholder="请输入 6 位验证码"
            />
            <PcButton
              class="shrink-0"
              variant="secondary"
              :disabled="sendDisabled"
              :loading="flow.sending"
              @click="requestCode"
            >
              {{ countdown > 0 ? `${countdown}s 后重试` : flow.sending ? "发送中…" : "获取验证码" }}
            </PcButton>
          </view>
        </view>
        <text v-else class="text-body text-muted leading-body"> 未绑定手机号，无需短信验证码 </text>
      </view>

      <view v-if="flow.errorMessage" class="rounded-card bg-danger-soft p-action">
        <text class="text-caption text-danger leading-caption">{{ flow.errorMessage }}</text>
      </view>
    </view>

    <template v-if="session.user" #actions>
      <PcButton
        block
        size="action"
        variant="danger"
        :disabled="cancelDisabled"
        :loading="flow.cancelling"
        @click="requestCancellation"
      >
        {{ flow.cancelling ? "注销中…" : "永久注销账户" }}
      </PcButton>
    </template>
  </SubPageLayout>
</template>
