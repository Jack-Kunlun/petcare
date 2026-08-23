<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import SubPageLayout from "@/components/SubPageLayout.vue";

const rewardId = ref("reward-1");
const requirements = ["补充猫粮与饮水", "清理猫砂盆", "上传到达与完成照片"] as const;
const nearby = ["小林 · 0.8km", "陈女士 · 1.3km", "阿哲 · 1.9km"] as const;

onLoad((query = {}) => {
  if (typeof query.id === "string" && query.id) {
    rewardId.value = query.id;
  }
});
</script>

<template>
  <SubPageLayout title="悬赏详情">
    <view class="flex flex-col gap-copy px-action py-card">
      <view class="flex gap-copy main-card p-action">
        <image
          class="h-card-cover w-card-cover shrink-0 rounded-control"
          src="/static/main/community-pet-1.jpg"
          mode="aspectFill"
        />
        <view class="min-w-0 flex flex-1 flex-col">
          <text class="card-heading">咪咪 · 英国蓝猫</text>
          <text class="mt-caption meta-text">上门喂养 · 2次</text>
          <text class="mt-sm text-amount text-danger font-semibold leading-card">¥68/次</text>
          <text class="mt-caption quiet-text">悬赏编号 {{ rewardId }}</text>
        </view>
      </view>

      <view class="main-card p-action">
        <view class="flex items-center gap-copy">
          <image
            class="h-avatar w-avatar rounded-full"
            src="/static/main/owner-2.jpg"
            mode="aspectFill"
          />
          <view class="flex flex-1 flex-col">
            <text class="text-body text-ink font-semibold leading-label">郑先生</text>
            <text class="mt-caption text-caption text-success leading-caption"
              >实名认证 · 信用良好</text
            >
          </view>
        </view>
        <view class="mt-action flex flex-col gap-copy border-t border-divider pt-action">
          <view class="flex items-center gap-sm">
            <image class="h-icon-xs w-icon-xs" src="/static/main/time.svg" mode="aspectFit" />
            <text class="meta-text">8月24日 14:00–16:00</text>
          </view>
          <view class="flex items-center gap-sm">
            <image
              class="h-icon-xs w-icon-xs"
              src="/static/main/bounty-location.svg"
              mode="aspectFit"
            />
            <text class="meta-text">上海市静安区悦庭花园</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">照护要求</text>
        <view class="mt-copy flex flex-col gap-copy">
          <view v-for="item in requirements" :key="item" class="flex items-center gap-sm">
            <image class="h-icon-xs w-icon-xs" src="/static/main/check.svg" mode="aspectFit" />
            <text class="meta-text">{{ item }}</text>
          </view>
        </view>
      </view>

      <view class="main-card p-action">
        <text class="card-heading">附近可服务照护者</text>
        <view class="mt-copy flex flex-col gap-sm">
          <view
            v-for="item in nearby"
            :key="item"
            class="flex items-center justify-between rounded-control bg-divider px-copy py-sm"
          >
            <text class="meta-text">{{ item }}</text>
            <text class="text-caption text-success leading-caption">信用良好</text>
          </view>
        </view>
      </view>
    </view>

    <template #actions>
      <view class="flex gap-copy">
        <view
          class="h-button flex flex-1 items-center justify-center border border-border rounded-control bg-divider opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-muted font-medium leading-label">联系发布者</text>
        </view>
        <view
          class="h-button flex flex-1 items-center justify-center rounded-control bg-brand opacity-50"
          aria-disabled="true"
        >
          <text class="text-body text-surface font-medium leading-label">申请接单</text>
        </view>
      </view>
    </template>
  </SubPageLayout>
</template>
