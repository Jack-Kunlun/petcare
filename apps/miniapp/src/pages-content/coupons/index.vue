<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const tabs = ["可使用", "已使用", "已过期"] as const;
const coupons = [
  { amount: "¥20", title: "上门服务立减券", rule: "满 ¥80 可用", time: "有效期至 2026-09-30" },
  { amount: "¥30", title: "新客洗护优惠券", rule: "满 ¥150 可用", time: "有效期至 2026-10-15" },
  { amount: "9折", title: "安心寄养折扣券", rule: "最高优惠 ¥50", time: "有效期至 2026-11-01" },
] as const;
</script>

<template>
  <SubPageLayout title="优惠券">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="rounded-card from-brand to-brand-active bg-gradient-to-r p-action text-surface">
        <text class="text-caption leading-caption">当前可用</text>
        <text class="mt-caption block text-page font-semibold leading-page">3 张优惠券</text>
        <text class="mt-sm block text-caption leading-caption">下单时可按使用规则选择</text>
      </view>

      <view class="h-control flex rounded-pill bg-surface p-caption shadow-card">
        <view
          v-for="(tab, index) in tabs"
          :key="tab"
          class="flex flex-1 items-center justify-center rounded-pill"
          :class="index === 0 ? 'bg-brand' : ''"
        >
          <text
            class="text-caption font-medium leading-caption"
            :class="index === 0 ? 'text-surface' : 'text-muted'"
          >
            {{ tab }}
          </text>
        </view>
      </view>

      <view v-for="coupon in coupons" :key="coupon.title" class="flex overflow-hidden main-card">
        <view class="w-pet flex shrink-0 flex-col items-center justify-center bg-soft p-copy">
          <text class="text-amount text-danger font-semibold leading-card">{{
            coupon.amount
          }}</text>
          <text class="mt-caption text-micro text-muted leading-micro">优惠</text>
        </view>
        <view class="min-w-0 flex flex-1 flex-col justify-center p-action">
          <text class="card-heading">{{ coupon.title }}</text>
          <text class="mt-caption meta-text">{{ coupon.rule }}</text>
          <text class="mt-caption quiet-text">{{ coupon.time }}</text>
        </view>
        <view
          class="h-control flex items-center self-center justify-center rounded-pill bg-brand px-copy opacity-50"
          aria-disabled="true"
        >
          <text class="text-caption text-surface font-medium leading-caption">立即使用</text>
        </view>
        <view class="w-sm shrink-0" />
      </view>
    </view>
  </SubPageLayout>
</template>
