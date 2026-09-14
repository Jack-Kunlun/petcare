<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { DEMO_STAGE, DEMO_STAGE_LABELS } from "@petcare/shared-types";
import type { DemoScenario, MiniappDemoAction } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { advanceDemo, createDemo, getDemo } from "@/api/demo";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { demoEnabled } from "@/config/features";
import { requireProfile, session } from "@/state/session";

definePage({
  style: { navigationBarTextStyle: "black", navigationStyle: "custom" },
});

const storageKey = "petcare-demo-code";
const scenario = ref<DemoScenario | null>(null);
const status = ref<"loading" | "ready" | "empty" | "error" | "unauthenticated" | "unavailable">(
  "loading",
);
const busy = ref(false);
const error = ref("");
const action = computed<{ key: MiniappDemoAction; label: string } | null>(() => {
  switch (scenario.value?.stage) {
    case DEMO_STAGE.QUALIFIED:
      return { key: "submit_intent", label: "演示服务者提交意向" };
    case DEMO_STAGE.INTENT:
      return { key: "confirm", label: "演示主人确认订单" };
    case DEMO_STAGE.CONFIRMED:
      return { key: "simulate_payment", label: "演示支付步骤（不会付款）" };
    case DEMO_STAGE.PAYMENT:
      return { key: "complete_sop", label: "演示履约完成" };
    default:
      return null;
  }
});

async function load(): Promise<void> {
  if (!demoEnabled) {
    status.value = "unavailable";

    return;
  }

  if (!session.user) {
    status.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  const saved = uni.getStorageSync(storageKey);

  if (typeof saved !== "string" || !/^[A-F0-9]{12}$/.test(saved)) {
    status.value = "empty";

    return;
  }

  status.value = "loading";
  error.value = "";

  try {
    scenario.value = await getDemo(saved);
    status.value = "ready";
  } catch (cause) {
    if (cause instanceof MiniappApiError && cause.statusCode === 404) {
      scenario.value = null;
      uni.removeStorageSync(storageKey);
      status.value = "empty";
    } else {
      error.value = getSafeRequestErrorMessage(cause, "读取演示失败，请稍后重试");
      status.value = "error";
    }
  }
}

async function start(): Promise<void> {
  if (busy.value || !demoEnabled) {
    return;
  }

  if (!session.user) {
    await requireProfile("/pages/demo/index");

    return;
  }

  busy.value = true;
  error.value = "";

  try {
    const created = await createDemo();

    uni.setStorageSync(storageKey, created.code);
    scenario.value = created;
    status.value = "ready";
  } catch (cause) {
    error.value = getSafeRequestErrorMessage(cause, "无法开始演示，请稍后重试");
    status.value = "error";
  } finally {
    busy.value = false;
  }
}

function recover(): void {
  if (status.value === "error" && uni.getStorageSync(storageKey)) {
    void load();
  } else {
    void start();
  }
}

async function advance(): Promise<void> {
  if (!scenario.value || !action.value || busy.value) {
    return;
  }

  busy.value = true;
  error.value = "";

  try {
    scenario.value = await advanceDemo(scenario.value.code, action.value.key);
  } catch (cause) {
    error.value = getSafeRequestErrorMessage(cause, "步骤未完成，请刷新演示状态后重试");
  } finally {
    busy.value = false;
  }
}

function copyCode(): void {
  if (scenario.value) {
    uni.setClipboardData({ data: scenario.value.code });
  }
}

onShow(() => {
  void load();
});

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void load();
    }
  },
);
</script>

<template>
  <SubPageLayout title="服务流程演示">
    <view class="px-page-horizontal py-section">
      <view class="main-card p-card-padding">
        <text class="section-heading">仅供体验，不产生真实订单</text>
        <text class="mt-copy block text-body text-ink leading-label">
          资格、支付、履约和结算均是演示状态；不会收款、生成正式资格、上传材料或约定真实服务。演示数据
          24 小时后自动清理。
        </text>
      </view>

      <PcStatePanel
        v-if="status !== 'ready'"
        class="mt-section"
        :status="status"
        :title="
          status === 'unavailable'
            ? '演示未开放'
            : status === 'unauthenticated'
              ? '登录后体验'
              : status === 'empty'
                ? '尚未开始演示'
                : status === 'loading'
                  ? '正在读取演示'
                  : '演示暂不可用'
        "
        :description="error || '开始后可将演示编号交给 PC 超管，协同完成资格和结算步骤。'"
        :primary-label="
          status === 'empty' || status === 'error'
            ? status === 'error'
              ? '重试'
              : '开始新演示'
            : status === 'unauthenticated'
              ? '登录体验'
              : ''
        "
        :primary-disabled="busy"
        @primary="recover"
      />

      <view v-if="status === 'ready' && scenario" class="mt-section main-card p-card-padding">
        <text class="section-heading">{{ DEMO_STAGE_LABELS[scenario.stage] }}</text>
        <text class="mt-copy block text-body text-ink">演示编号：{{ scenario.code }}</text>
        <PcButton class="mt-copy" variant="secondary" @click="copyCode"
          >复制编号给 PC 超管</PcButton
        >
        <view class="mt-section flex flex-col gap-copy">
          <text
            v-for="(event, index) in scenario.events"
            :key="`${event.stage}-${index}`"
            class="text-body text-ink"
          >
            {{ index + 1 }}. {{ DEMO_STAGE_LABELS[event.stage] }}
          </text>
        </view>
        <text v-if="error" class="mt-copy block text-body text-ink" role="alert">{{ error }}</text>
        <PcButton
          v-if="action"
          class="mt-section"
          block
          size="action"
          :loading="busy"
          :disabled="busy"
          @click="advance"
        >
          {{ action.label }}
        </PcButton>
        <text
          v-else-if="scenario.stage !== DEMO_STAGE.SETTLEMENT"
          class="mt-section block text-body text-ink"
        >
          下一步由 PC 超管在管理后台完成；之后返回本页刷新状态。
        </text>
        <PcButton class="mt-copy" block variant="ghost" :disabled="busy" @click="load"
          >刷新演示状态</PcButton
        >
        <PcButton class="mt-copy" block variant="ghost" :loading="busy" @click="start"
          >开始新演示</PcButton
        >
      </view>
    </view>
  </SubPageLayout>
</template>
