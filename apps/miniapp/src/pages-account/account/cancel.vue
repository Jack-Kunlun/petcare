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
        <text class="text-body text-ink leading-body">
          历史订单、投诉及必要审计记录会按规则保留。
        </text>
        <text class="text-body text-ink leading-body">
          进行中的订单会阻止注销，请先完成或取消相关订单。
        </text>
      </view>

      <view v-if="!session.user" class="main-card p-action">
        <text class="text-body text-danger leading-body">登录状态已失效，请返回后重新登录</text>
      </view>

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
            <button
              class="h-control shrink-0 border border-danger rounded-control bg-surface px-copy text-caption text-danger"
              :class="sendDisabled ? 'opacity-50' : ''"
              :disabled="sendDisabled"
              :aria-disabled="sendDisabled"
              :loading="flow.sending"
              @click="requestCode"
            >
              {{ countdown > 0 ? `${countdown}s 后重试` : flow.sending ? "发送中…" : "获取验证码" }}
            </button>
          </view>
        </view>
        <text v-else class="text-body text-muted leading-body"> 未绑定手机号，无需短信验证码 </text>
      </view>

      <view v-if="flow.errorMessage" class="rounded-card bg-danger-soft p-action">
        <text class="text-caption text-danger leading-caption">{{ flow.errorMessage }}</text>
      </view>
    </view>

    <template #actions>
      <button
        class="h-button flex items-center justify-center rounded-control bg-danger"
        :class="cancelDisabled ? 'opacity-50' : ''"
        :disabled="cancelDisabled"
        :aria-disabled="cancelDisabled"
        :loading="flow.cancelling"
        @click="requestCancellation"
      >
        <text class="text-button text-surface font-semibold leading-button">
          {{ flow.cancelling ? "注销中…" : "永久注销账户" }}
        </text>
      </button>
    </template>
  </SubPageLayout>
</template>
