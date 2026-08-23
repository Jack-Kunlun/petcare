<script setup lang="ts">
import SubPageLayout from "@/components/SubPageLayout.vue";

const statuses = ["全部", "待付款", "待服务", "服务中", "已完成"] as const;
const orders = [
  {
    id: "order-1",
    pet: "咪咪 · 英国短毛猫",
    service: "上门喂养 · 第 2 次服务",
    time: "今天 12:30",
    status: "服务中",
    price: "¥136",
    image: "/static/main/profile-cat.png",
  },
  {
    id: "order-2",
    pet: "旺财 · 金毛寻回犬",
    service: "遛狗 · 60分钟",
    time: "明天 09:00",
    status: "待服务",
    price: "¥76",
    image: "/static/main/profile-dog.png",
  },
  {
    id: "order-3",
    pet: "咪咪 · 英国短毛猫",
    service: "上门梳毛 · 基础护理",
    time: "8月18日 15:00",
    status: "已完成",
    price: "¥98",
    image: "/static/main/profile-cat.png",
  },
] as const;

function openOrder(id: string) {
  uni.navigateTo({ url: `/pages-care/order/detail?id=${encodeURIComponent(id)}` });
}
</script>

<template>
  <SubPageLayout title="我的订单">
    <view class="flex flex-col gap-copy px-action py-card">
      <scroll-view class="w-full" scroll-x :show-scrollbar="false">
        <view class="h-control flex rounded-pill bg-surface p-caption shadow-card">
          <view
            v-for="(status, index) in statuses"
            :key="status"
            class="min-w-0 flex flex-1 items-center justify-center rounded-pill px-sm"
            :class="index === 0 ? 'bg-brand' : ''"
          >
            <text
              class="whitespace-nowrap text-caption font-medium leading-caption"
              :class="index === 0 ? 'text-surface' : 'text-muted'"
            >
              {{ status }}
            </text>
          </view>
        </view>
      </scroll-view>

      <view
        v-for="order in orders"
        :key="order.id"
        class="main-card p-action"
        hover-class="opacity-80"
        @click="openOrder(order.id)"
      >
        <view class="flex items-center justify-between border-b border-divider pb-copy">
          <text class="text-caption text-muted leading-caption">订单 {{ order.id }}</text>
          <text class="text-caption text-brand font-medium leading-caption">{{
            order.status
          }}</text>
        </view>
        <view class="flex gap-copy py-action">
          <image
            class="h-mini-cover w-mini-cover rounded-control"
            :src="order.image"
            mode="aspectFill"
          />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="card-heading">{{ order.pet }}</text>
            <text class="mt-caption meta-text">{{ order.service }}</text>
            <text class="mt-sm quiet-text">{{ order.time }}</text>
          </view>
          <text class="text-card text-ink font-semibold leading-card">{{ order.price }}</text>
        </view>
        <view class="flex justify-end border-t border-divider pt-copy">
          <text class="text-caption text-brand font-medium leading-caption">查看订单详情</text>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
