<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const orderId = ref("order-1");
const events = ["12:28 照护者已到达", "12:36 已补充猫粮与饮水", "12:45 已清理猫砂盆"] as const;

onLoad((query = {}) => {
  if (typeof query.orderId === "string" && query.orderId) {
    orderId.value = query.orderId;
  }
});
</script>

<template>
  <SubPageLayout title="实时照护">
    <view class="flex flex-col gap-copy px-action py-card">
      <view
        class="h-hero-main flex flex-col justify-between rounded-card bg-ink p-action shadow-card"
      >
        <view class="flex items-center justify-between">
          <view class="rounded-badge bg-danger px-sm py-caption">
            <text class="text-caption text-surface font-semibold leading-caption">LIVE</text>
          </view>
          <text class="text-caption text-surface leading-caption">12:48:26</text>
        </view>
        <view class="flex flex-col items-center gap-sm">
          <image
            class="h-icon-md w-icon-md opacity-50"
            src="/static/auth/camera.svg"
            mode="aspectFit"
          />
          <text class="text-body text-surface font-medium leading-label">静态监控预览</text>
          <text class="text-caption text-subtle leading-caption">未连接真实视频设备</text>
        </view>
        <text class="text-caption text-subtle leading-caption">订单 {{ orderId }}</text>
      </view>

      <view class="flex justify-between main-card p-copy">
        <view
          v-for="control in ['静音', '清晰度', '全屏', '截图']"
          :key="control"
          class="h-control flex flex-1 items-center justify-center opacity-50"
          aria-disabled="true"
        >
          <text class="text-caption text-muted leading-caption">{{ control }}</text>
        </view>
      </view>

      <view class="main-card p-action">
        <view class="flex items-center justify-between">
          <text class="card-heading">设备状态</text>
          <text class="text-caption text-success font-medium leading-caption">在线</text>
        </view>
        <text class="mt-sm block meta-text">客厅摄像头 · 网络稳定 · 电量 86%</text>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">照护事件</text>
        <view class="mt-copy flex flex-col gap-copy">
          <view v-for="event in events" :key="event" class="flex items-center gap-sm">
            <view class="h-dot w-dot rounded-full bg-success" />
            <text class="meta-text">{{ event }}</text>
          </view>
        </view>
      </view>
    </view>
  </SubPageLayout>
</template>
