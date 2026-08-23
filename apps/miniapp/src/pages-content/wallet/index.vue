<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const transactions = [
  { title: "上门喂养服务收入", time: "2026-08-20 18:30", amount: "+¥68" },
  { title: "遛狗服务支出", time: "2026-08-18 10:12", amount: "-¥76" },
  { title: "平台活动奖励", time: "2026-08-12 09:05", amount: "+¥20" },
  { title: "洗护服务支出", time: "2026-08-06 16:40", amount: "-¥128" },
] as const;
</script>

<template>
  <SubPageLayout title="我的钱包">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="rounded-card from-brand to-brand-active bg-gradient-to-r p-card text-surface">
        <text class="text-caption leading-caption">可用余额</text>
        <text class="mt-sm block text-title font-semibold leading-title">¥856.00</text>
        <text class="mt-action block text-caption leading-caption">累计收入 ¥1,268.00</text>
        <view class="mt-action flex gap-copy">
          <view
            v-for="action in ['充值', '提现']"
            :key="action"
            class="h-control flex flex-1 items-center justify-center rounded-control bg-surface opacity-50"
            aria-disabled="true"
          >
            <text class="text-body text-brand font-medium leading-label">{{ action }}</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">收支明细</text>
        <view class="mt-copy flex flex-col">
          <view
            v-for="(item, index) in transactions"
            :key="item.time"
            class="flex items-center justify-between gap-copy py-copy"
            :class="index < transactions.length - 1 ? 'border-b border-divider' : ''"
          >
            <view class="min-w-0 flex flex-1 flex-col">
              <text class="text-body text-ink font-medium leading-label">{{ item.title }}</text>
              <text class="mt-caption quiet-text">{{ item.time }}</text>
            </view>
            <text
              class="text-body font-semibold leading-label"
              :class="item.amount.startsWith('+') ? 'text-success' : 'text-ink'"
            >
              {{ item.amount }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
