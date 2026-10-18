<script setup lang="ts">
import { computed, ref } from "vue";
import PcButton from "@/components/PcButton.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

type CouponStatus = "available" | "used" | "expired";
const activeStatus = ref<CouponStatus>("available");
const coupons = [
  {
    id: "new-user",
    value: "¥20",
    condition: "满 ¥99 可用",
    name: "新用户宠物服务券",
    expires: "领取后 30 天内有效",
    status: "available",
  },
  {
    id: "care",
    value: "9 折",
    condition: "最高减 ¥30",
    name: "上门照护通用券",
    expires: "领取后 30 天内有效",
    status: "available",
  },
  {
    id: "community",
    value: "¥15",
    condition: "满 ¥68 可用",
    name: "社区活动奖励券",
    expires: "领取后 30 天内有效",
    status: "available",
  },
  {
    id: "used-care",
    value: "¥10",
    condition: "满 ¥68 可用",
    name: "上门照护体验券",
    expires: "2026-10-01 已使用",
    status: "used",
  },
  {
    id: "expired-care",
    value: "¥15",
    condition: "满 ¥99 可用",
    name: "养宠活动券",
    expires: "2026-09-30 已过期",
    status: "expired",
  },
] satisfies {
  id: string;
  value: string;
  condition: string;
  name: string;
  expires: string;
  status: CouponStatus;
}[];

const visibleCoupons = computed(() =>
  coupons.filter((coupon) => coupon.status === activeStatus.value),
);
const tabs: { value: CouponStatus; label: string }[] = [
  { value: "available", label: "可使用 3" },
  { value: "used", label: "已使用" },
  { value: "expired", label: "已过期" },
];

function useCoupon(coupon: (typeof coupons)[number]): void {
  uni.showModal({
    title: coupon.name,
    content: `${coupon.condition}，${coupon.expires}。此券为页面展示示例，不抵扣真实订单。`,
    showCancel: false,
    confirmText: "知道了",
  });
}
</script>

<template>
  <SubPageLayout title="我的优惠券">
    <view class="coupons">
      <view class="coupons__tabs" role="tablist" aria-label="优惠券状态">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="coupons__tab"
          :class="{ 'coupons__tab--active': activeStatus === tab.value }"
          :aria-selected="activeStatus === tab.value"
          role="tab"
          @click="activeStatus = tab.value"
        >
          {{ tab.label }}
        </button>
      </view>

      <view v-if="visibleCoupons.length > 0" class="coupons__list">
        <view v-for="coupon in visibleCoupons" :key="coupon.id" class="coupon-card">
          <view class="coupon-card__value">
            <text class="coupon-card__amount">{{ coupon.value }}</text>
            <text class="coupon-card__condition">{{ coupon.condition }}</text>
          </view>
          <view class="coupon-card__content">
            <text class="coupon-card__name">{{ coupon.name }}</text>
            <text class="coupon-card__expires">{{ coupon.expires }}</text>
            <PcButton class="coupon-card__action" size="control" @click="useCoupon(coupon)">
              使用规则
            </PcButton>
          </view>
        </view>
      </view>
      <view v-else class="coupons__empty">
        <text>{{ activeStatus === "used" ? "暂无已使用优惠券" : "暂无已过期优惠券" }}</text>
      </view>
    </view>
  </SubPageLayout>
</template>

<style scoped lang="scss">
.coupons {
  min-height: 100%;
  box-sizing: border-box;
  padding: 16px;
  background: #f8fafc;

  &__tabs {
    display: flex;
    height: 44px;
    align-items: center;
    justify-content: space-around;
    margin-bottom: 20px;
    border-radius: 12px;
    background: #fff;
  }

  &__tab {
    display: flex;
    min-width: 84px;
    height: 44px;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: #667085;
    font-size: 14px;

    &::after {
      border: 0;
    }

    &--active {
      color: #2563eb;
      font-weight: 500;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__empty {
    padding: 56px 16px;
    color: #667085;
    font-size: 14px;
    text-align: center;
  }
}

.coupon-card {
  display: flex;
  min-height: 136px;
  overflow: hidden;
  border: 1px solid #f2f4f7;
  border-radius: 12px;
  background: #fff;

  &__value {
    display: flex;
    width: 104px;
    flex: 0 0 104px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: #eef2ff;
  }

  &__amount {
    color: #3552c8;
    font-size: 24px;
    font-weight: 500;
    line-height: 36px;
  }

  &__condition {
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__content {
    position: relative;
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    padding: 22px 15px;
  }

  &__name {
    overflow: hidden;
    color: #1f2937;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__expires {
    margin-top: 8px;
    color: #667085;
    font-size: 12px;
    line-height: 18px;
  }

  &__action {
    position: absolute;
    right: 22px;
    bottom: 10px;
    min-width: 72px;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 999px;
    font-size: 12px;
    line-height: 18px;
  }
}

.coupon-card__action :deep(.pc-button) {
  border-radius: 999px;
}

.coupons :deep(.coupon-card__action) {
  border-radius: 999px;
}
</style>
