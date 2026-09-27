<script setup lang="ts">
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { session } from "@/state/session";

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}
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

      <template v-else>
        <view class="main-card p-card-padding">
          <text class="meta-text">可提现余额</text>
          <text class="mt-caption block text-amount text-ink font-semibold leading-section"
            >¥0.00</text
          >
          <text class="mt-caption block text-caption text-muted leading-caption">
            当前没有已完成真实收款的可提现订单
          </text>
          <PcButton class="mt-copy" variant="secondary" disabled block> 提现 </PcButton>
        </view>

        <view class="main-card p-card-padding">
          <text class="card-heading">收入记录</text>
          <view class="mt-copy rounded-control bg-divider p-copy">
            <text class="text-body text-ink leading-body">暂无可结算收入</text>
            <text class="mt-caption block text-caption text-muted leading-caption">
              模拟支付订单可正常完成服务流程，但不会形成可提现余额。
            </text>
          </view>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
