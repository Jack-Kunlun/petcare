<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import type { ProviderIncomeSummary } from "@petcare/shared-types";
import { ref } from "vue";
import { MiniappApiError } from "@/api/request";
import { getProviderIncome } from "@/api/settlement";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { session } from "@/state/session";

const status = ref<"loading" | "ready" | "error">("loading");
const income = ref<ProviderIncomeSummary | null>(null);

function formatAmount(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

async function loadIncome(): Promise<void> {
  if (!session.user) {
    status.value = "ready";
    income.value = null;

    return;
  }

  status.value = "loading";

  try {
    income.value = await getProviderIncome();
    status.value = "ready";
  } catch (error) {
    status.value = error instanceof MiniappApiError && error.statusCode === 401 ? "ready" : "error";
  }
}

onShow(() => void loadIncome());
</script>

<template>
  <SubPageLayout title="收入与提现">
    <view class="flex flex-col gap-copy px-action py-card">
      <PcStatePanel
        v-if="!session.user"
        status="unauthenticated"
        title="登录后查看收入"
        description="登录后可查看服务订单收入与提现状态。"
        primary-label="微信登录"
        @primary="openLogin"
      />

      <PcStatePanel v-else-if="status === 'loading'" status="loading" title="收入加载中…" />
      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="收入加载失败"
        description="请稍后重试。"
        primary-label="重新加载"
        @primary="loadIncome"
      />

      <template v-else-if="income">
        <view class="main-card p-card-padding">
          <text class="meta-text">可提现余额</text>
          <text class="mt-caption block text-amount text-ink font-semibold leading-section">
            {{ formatAmount(income.availableCents) }}
          </text>
          <text class="mt-caption block text-caption text-muted leading-caption">
            {{
              income.availableCents > 0
                ? "提现主体配置完成后可申请出款"
                : "当前没有已完成真实收款的可提现订单"
            }}
          </text>
          <PcButton class="mt-copy" variant="secondary" disabled block> 提现 </PcButton>
        </view>

        <view class="main-card p-card-padding">
          <text class="card-heading">收入记录</text>
          <view
            v-if="income.entries.length === 0"
            class="mt-copy rounded-control bg-divider p-copy"
          >
            <text class="text-body text-ink leading-body">暂无可结算收入</text>
            <text class="mt-caption block text-caption text-muted leading-caption">
              未收款订单可正常完成服务流程，但不会形成可提现余额。
            </text>
          </view>
          <view v-else class="mt-copy flex flex-col gap-sm">
            <view
              v-for="entry in income.entries"
              :key="entry.id"
              class="rounded-control bg-divider p-copy"
            >
              <view class="flex items-center justify-between gap-copy">
                <text class="text-body text-ink leading-body">{{
                  formatAmount(entry.amountCents)
                }}</text>
                <text
                  class="text-caption leading-caption"
                  :class="entry.withdrawable ? 'text-success' : 'text-muted'"
                >
                  {{ entry.withdrawable ? "可提现" : "待配置结算" }}
                </text>
              </view>
              <text class="mt-caption block text-caption text-muted leading-caption">
                订单 {{ entry.orderId.slice(0, 8) }}
              </text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
