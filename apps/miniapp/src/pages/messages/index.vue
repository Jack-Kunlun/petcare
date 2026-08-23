<script setup lang="ts">
import { getMessageTarget } from "./message-route";
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

interface MessageItem {
  id: string;
  kind: "system" | "order" | "interaction";
  title: string;
  preview: string;
  time: string;
  avatar?: string;
  icon?: string;
  tone?: string;
  badge?: number;
  unread?: boolean;
}

const categoryTabs = ["全部", "系统通知", "订单消息", "互动消息"] as const;

const messages: MessageItem[] = [
  {
    id: "user-1",
    kind: "interaction",
    title: "小林",
    preview: "好的，我大概 14:00 到达，到时先联系你。",
    time: "10:32",
    avatar: "/static/main/owner-1.jpg",
    badge: 2,
  },
  {
    id: "order-1",
    kind: "order",
    title: "订单已被接单",
    preview: "照护者小林已接下咪咪的上门喂养服务。",
    time: "09:48",
    icon: "/static/main/check.svg",
    tone: "bg-success-soft",
    unread: true,
  },
  {
    id: "order-1",
    kind: "order",
    title: "照护者已到达",
    preview: "服务进行中，照护记录会实时同步给你。",
    time: "进行中",
    icon: "/static/main/bell.svg",
    tone: "bg-soft",
    unread: true,
  },
  {
    id: "user-3",
    kind: "interaction",
    title: "小萌评论了你的动态",
    preview: "“旺财也太可爱了，下次一起去呀！”",
    time: "08:16",
    avatar: "/static/main/owner-3.jpg",
  },
  {
    id: "notice-1",
    kind: "system",
    title: "服务提醒",
    preview: "你预约的遛狗服务将在明天 09:00 开始。",
    time: "昨天",
    icon: "/static/main/bell.svg",
    tone: "bg-warning-soft",
  },
  {
    id: "notice-2",
    kind: "system",
    title: "收到新的赞",
    preview: "栗子妈妈等 8 人赞了你的社区动态。",
    time: "昨天",
    icon: "/static/main/heart.svg",
    tone: "bg-danger-soft",
  },
];

function openMessage(item: MessageItem) {
  const target = getMessageTarget(item.kind, item.id);

  if (target) {
    uni.navigateTo({ url: target });
  }
}
</script>

<template>
  <MainTabLayout active="messages">
    <view class="box-border flex flex-col pb-screen">
      <view class="h-header flex items-center justify-between px-action">
        <text class="page-heading">消息</text>
        <text class="text-caption text-brand leading-caption">全部已读</text>
      </view>

      <view class="mx-action h-control flex rounded-pill bg-surface p-caption">
        <view
          v-for="(tab, index) in categoryTabs"
          :key="tab"
          class="min-w-0 flex flex-1 items-center justify-center rounded-pill"
          :class="index === 0 ? 'bg-brand' : 'bg-surface'"
        >
          <text
            class="whitespace-nowrap text-caption font-medium leading-caption"
            :class="index === 0 ? 'text-surface' : 'text-muted'"
          >
            {{ tab }}
          </text>
        </view>
      </view>

      <view class="px-action pb-sm pt-caption">
        <text class="text-caption text-muted font-medium leading-caption">今天</text>
      </view>

      <view class="mx-action overflow-hidden main-card">
        <view
          v-for="(item, index) in messages"
          :key="item.title"
          class="relative flex gap-copy px-action py-action"
          :class="index < messages.length - 1 ? 'border-b border-divider' : ''"
          :hover-class="item.kind === 'system' ? 'none' : 'opacity-80'"
          @click="openMessage(item)"
        >
          <image
            v-if="item.avatar"
            class="h-avatar w-avatar shrink-0 rounded-full"
            :src="item.avatar"
            mode="aspectFill"
          />
          <view
            v-else
            class="h-avatar w-avatar flex shrink-0 items-center justify-center rounded-full"
            :class="item.tone"
          >
            <image class="h-glyph w-glyph" :src="item.icon" mode="aspectFit" />
          </view>

          <view class="min-w-0 flex flex-1 flex-col gap-caption">
            <view class="flex items-center justify-between gap-sm">
              <text class="truncate text-body text-ink font-semibold leading-label">
                {{ item.title }}
              </text>
              <text class="shrink-0 quiet-text">{{ item.time }}</text>
            </view>
            <view class="flex items-center justify-between gap-sm">
              <text class="truncate meta-text">{{ item.preview }}</text>
              <view
                v-if="item.badge"
                class="h-icon-xs w-icon-xs flex shrink-0 items-center justify-center rounded-full bg-danger"
              >
                <text class="text-micro text-surface font-medium leading-badge">{{
                  item.badge
                }}</text>
              </view>
              <view v-else-if="item.unread" class="h-dot w-dot shrink-0 rounded-full bg-brand" />
            </view>
          </view>
        </view>
      </view>

      <view class="mt-card flex justify-center">
        <text class="quiet-text">仅展示最近 30 天的消息</text>
      </view>
    </view>
  </MainTabLayout>
</template>
