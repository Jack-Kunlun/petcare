<script setup lang="ts">
import type {
  OrderPaymentStatus,
  OrderPaymentSummary,
  OrderPrepayResponse,
  WechatPaymentParameters,
} from "@petcare/shared-types";
import { onMounted, ref } from "vue";
import {
  getOrderPayment,
  prepayOrder,
  refreshOrderPayment,
  simulateOrderPayment,
} from "@/api/payment";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import { paymentSimulationEnabled } from "@/config/features";

const props = defineProps<{
  orderId: string;
  amountCents: number;
}>();

type PanelStatus =
  | "loading"
  | "ready"
  | "pending"
  | "succeeded"
  | "simulated"
  | "closed"
  | "refunded"
  | "unavailable"
  | "error";

const status = ref<PanelStatus>("loading");
const payment = ref<OrderPaymentSummary | null>(null);
const busy = ref(false);
const message = ref("");
const failed = ref(false);

function formatAmount(amountCents: number): string {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

function panelStatus(value: OrderPaymentStatus): PanelStatus {
  return value === "refund_pending" ? "pending" : value;
}

function statusLabel(value: PanelStatus): string {
  return {
    loading: "支付状态读取中…",
    ready: "待支付",
    pending: "支付结果确认中",
    succeeded: "已支付",
    simulated: "模拟通过（未收款）",
    closed: "支付已关闭",
    refunded: "已退款",
    unavailable: "支付服务未开放",
    error: "支付状态读取失败",
  }[value];
}

function showMessage(value: string, isFailed = false): void {
  message.value = value;
  failed.value = isFailed;
}

function isPaymentNotFound(error: unknown): boolean {
  return error instanceof MiniappApiError && error.code === "PAYMENT_NOT_FOUND";
}

function isPaymentUnavailable(error: unknown): boolean {
  return error instanceof MiniappApiError && error.code === "PAYMENT_NOT_OPEN";
}

async function load(): Promise<void> {
  status.value = "loading";
  message.value = "";

  try {
    const next = await getOrderPayment(props.orderId);

    payment.value = next;
    status.value = panelStatus(next.status);
  } catch (error) {
    payment.value = null;

    if (isPaymentNotFound(error)) {
      status.value = "ready";
    } else if (isPaymentUnavailable(error)) {
      status.value = "unavailable";
    } else {
      status.value = "error";
    }

    if (!isPaymentNotFound(error) && !isPaymentUnavailable(error)) {
      showMessage(getSafeRequestErrorMessage(error, "支付状态读取失败，请重试。"), true);
    } else if (isPaymentUnavailable(error)) {
      showMessage("当前仅可查看订单，支付服务尚未开放。", false);
    }
  }
}

function requestWechatPayment(parameters: WechatPaymentParameters): Promise<"success" | "cancel"> {
  type RequestPaymentOptions = WechatPaymentParameters & {
    success?: () => void;
    fail?: (error: { errMsg?: string }) => void;
  };
  const requestPayment = (
    uni as typeof uni & { requestPayment?: (options: RequestPaymentOptions) => void }
  ).requestPayment;

  if (!requestPayment) {
    return Promise.reject(new Error("当前环境不支持微信支付"));
  }

  return new Promise((resolve, reject) => {
    requestPayment({
      ...parameters,
      success: () => resolve("success"),
      fail: (error) => {
        if (error.errMsg?.toLowerCase().includes("cancel")) {
          resolve("cancel");
        } else {
          reject(new Error(error.errMsg || "微信支付调起失败"));
        }
      },
    });
  });
}

async function pay(): Promise<void> {
  if (busy.value || (status.value !== "ready" && status.value !== "pending")) {
    return;
  }

  busy.value = true;
  message.value = "";

  try {
    if (paymentSimulationEnabled) {
      const next = await simulateOrderPayment(props.orderId);

      payment.value = next;
      status.value = panelStatus(next.status);
      showMessage("模拟支付已通过，未发生真实收款。", false);

      return;
    }

    const response: OrderPrepayResponse = await prepayOrder(props.orderId);

    payment.value = response.payment;
    status.value = "pending";
    const result = await requestWechatPayment(response.parameters);

    if (result === "cancel") {
      showMessage("支付未完成，可稍后重试。", false);

      return;
    }

    const next = await refreshOrderPayment(props.orderId);

    payment.value = next;
    status.value = panelStatus(next.status);
    showMessage(
      next.status === "succeeded" ? "支付已由服务端确认。" : "支付已提交，结果仍在确认中。",
      false,
    );
  } catch (error) {
    if (isPaymentUnavailable(error)) {
      status.value = "unavailable";
      showMessage("当前仅可查看订单，支付服务尚未开放。", false);
    } else {
      showMessage(getSafeRequestErrorMessage(error, "支付结果暂未确认，请稍后查询。"), true);
      await load();
    }
  } finally {
    busy.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <view class="flex flex-col gap-sm border-t border-divider pt-copy" aria-label="订单支付">
    <view class="flex items-center justify-between gap-copy">
      <text class="card-heading">{{ paymentSimulationEnabled ? "订单模拟支付" : "订单支付" }}</text>
      <text class="quiet-text"
        >参考金额 {{ formatAmount(payment?.amountCents ?? amountCents) }}</text
      >
    </view>

    <text class="meta-text">{{ statusLabel(status) }}</text>
    <text v-if="paymentSimulationEnabled" class="meta-text" role="status">
      此订单仅模拟支付，不会扣款；完成后仍为未收款订单。
    </text>

    <view
      v-if="message"
      class="border rounded-control p-copy text-small leading-body"
      :class="
        failed ? 'border-danger bg-danger-soft text-danger' : 'border-border bg-soft text-ink'
      "
      :role="failed ? 'alert' : 'status'"
      aria-live="polite"
    >
      <text>{{ message }}</text>
    </view>

    <PcButton
      v-if="status === 'ready' || status === 'pending'"
      block
      :disabled="busy"
      :loading="busy"
      :aria-label="
        paymentSimulationEnabled
          ? '模拟支付（未收款）'
          : status === 'pending'
            ? '继续支付'
            : '立即支付'
      "
      @click="pay"
    >
      {{
        paymentSimulationEnabled
          ? "模拟支付（未收款）"
          : status === "pending"
            ? "继续支付"
            : "立即支付"
      }}
    </PcButton>
    <PcButton v-else-if="status === 'error'" block variant="secondary" @click="load">
      重试查询
    </PcButton>
  </view>
</template>
