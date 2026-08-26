<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "@petcare/shared-types";
import type { NotificationCategory, UserNotification } from "@petcare/shared-types";
import { computed, ref } from "vue";
import { getMessageTarget } from "./message-route";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications";
import MainTabLayout from "@/components/MainTabLayout.vue";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const PAGE_SIZE = 20;
const categoryTabs: ReadonlyArray<{
  label: string;
  value: NotificationCategory | null;
}> = [
  { label: "全部", value: null },
  { label: "系统通知", value: NOTIFICATION_CATEGORY.SYSTEM },
  { label: "订单消息", value: NOTIFICATION_CATEGORY.ORDER },
  { label: "互动消息", value: NOTIFICATION_CATEGORY.INTERACTION },
];

const notifications = ref<UserNotification[]>([]);
const activeCategory = ref<NotificationCategory | null>(null);
const status = ref<"idle" | "loading" | "ready" | "error">("idle");
const loading = ref(false);
const loadMoreError = ref(false);
const page = ref(1);
const total = ref(0);
const openingId = ref<string | null>(null);
const markingAll = ref(false);
const hasMore = computed(() => notifications.value.length < total.value);
const hasUnread = computed(() => notifications.value.some((item) => !item.isRead));
const markAllDisabled = computed(() => loading.value || markingAll.value || !hasUnread.value);

function notificationIcon(item: UserNotification): string {
  if (item.type === NOTIFICATION_TYPE.COMMUNITY_LIKE) {
    return "/static/main/heart.svg";
  }

  return item.category === NOTIFICATION_CATEGORY.ORDER
    ? "/static/main/check.svg"
    : "/static/main/bell.svg";
}

function notificationTone(item: UserNotification): string {
  if (item.type === NOTIFICATION_TYPE.COMMUNITY_LIKE) {
    return "bg-danger-soft";
  }

  return item.category === NOTIFICATION_CATEGORY.ORDER ? "bg-success-soft" : "bg-soft";
}

function notificationTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function isActionable(item: UserNotification): boolean {
  return Boolean(getMessageTarget(item.category, item.referenceId));
}

async function loadNotifications(reset = true): Promise<void> {
  if (loading.value) {
    return;
  }

  loading.value = true;
  loadMoreError.value = false;

  if (reset) {
    status.value = "loading";
  }

  try {
    const nextPage = reset ? 1 : page.value + 1;
    const response = await getNotifications({
      page: nextPage,
      pageSize: PAGE_SIZE,
      category: activeCategory.value ?? undefined,
    });

    notifications.value = reset ? response.list : [...notifications.value, ...response.list];
    page.value = response.page;
    total.value = response.total;
    status.value = "ready";
  } catch {
    if (reset) {
      notifications.value = [];
      total.value = 0;
      status.value = "error";
    } else {
      loadMoreError.value = true;
    }
  } finally {
    loading.value = false;
  }
}

function selectCategory(category: NotificationCategory | null): void {
  if (loading.value || activeCategory.value === category) {
    return;
  }

  activeCategory.value = category;
  void loadNotifications();
}

async function markAllRead(): Promise<void> {
  if (markAllDisabled.value) {
    return;
  }

  markingAll.value = true;

  try {
    await markAllNotificationsRead();
    notifications.value = notifications.value.map((item) => ({ ...item, isRead: true }));
  } catch {
    uni.showToast({ title: "全部已读失败，请重试", icon: "none" });
  } finally {
    markingAll.value = false;
  }
}

async function openNotification(item: UserNotification): Promise<void> {
  const target = getMessageTarget(item.category, item.referenceId);

  if (!target || openingId.value) {
    return;
  }

  openingId.value = item.id;

  try {
    const updated = await markNotificationRead(item.id);
    const index = notifications.value.findIndex((candidate) => candidate.id === item.id);

    if (index >= 0) {
      notifications.value[index] = updated;
    }

    uni.navigateTo({ url: target });
  } catch {
    uni.showToast({ title: "消息暂时无法打开", icon: "none" });
  } finally {
    openingId.value = null;
  }
}

onShow(() => void loadNotifications());
</script>

<template>
  <MainTabLayout active="messages">
    <template #header>
      <view class="flex items-center justify-between">
        <text class="page-heading">消息</text>
        <button
          class="min-h-control m-0 bg-transparent p-0 text-caption text-brand leading-caption after:border-none"
          :class="markAllDisabled ? 'opacity-50' : ''"
          :disabled="markAllDisabled"
          :aria-disabled="markAllDisabled"
          :loading="markingAll"
          @click="markAllRead"
        >
          {{ markingAll ? "处理中" : "全部已读" }}
        </button>
      </view>
    </template>

    <view class="box-border flex flex-col pb-screen">
      <view class="mx-page-horizontal h-control flex rounded-pill bg-surface p-caption">
        <view
          v-for="tab in categoryTabs"
          :key="tab.label"
          class="min-w-0 flex flex-1 items-center justify-center rounded-pill"
          :class="[
            activeCategory === tab.value ? 'bg-brand' : 'bg-surface',
            loading ? 'opacity-50' : '',
          ]"
          role="button"
          :aria-pressed="activeCategory === tab.value"
          :aria-disabled="loading"
          @click="selectCategory(tab.value)"
        >
          <text
            class="whitespace-nowrap text-caption font-medium leading-caption"
            :class="activeCategory === tab.value ? 'text-surface' : 'text-muted'"
          >
            {{ tab.label }}
          </text>
        </view>
      </view>

      <view v-if="status === 'loading'" class="mx-page-horizontal mt-card" aria-live="polite">
        <text class="quiet-text">消息加载中…</text>
      </view>

      <view
        v-else-if="status === 'error'"
        class="mx-page-horizontal mt-card flex flex-col gap-copy rounded-control bg-danger-soft p-card-padding"
        role="alert"
      >
        <text class="text-body text-danger leading-body">消息加载失败，请稍后重试</text>
        <button
          class="h-control rounded-control bg-brand-active text-body text-surface font-medium"
          :disabled="loading"
          :aria-disabled="loading"
          @click="loadNotifications()"
        >
          重试
        </button>
      </view>

      <view v-else-if="notifications.length === 0" class="mx-page-horizontal mt-card main-card">
        <text class="block p-card-padding text-center text-body text-muted leading-body">
          暂无消息
        </text>
      </view>

      <template v-else>
        <view class="px-page-horizontal pb-sm pt-caption">
          <text class="text-caption text-muted font-medium leading-caption">最新消息</text>
        </view>

        <view class="mx-page-horizontal overflow-hidden main-card">
          <view
            v-for="(item, index) in notifications"
            :key="item.id"
            class="relative flex gap-copy px-card-padding py-action"
            :class="[
              index < notifications.length - 1 ? 'border-b border-divider' : '',
              openingId ? 'opacity-50' : '',
            ]"
            :hover-class="isActionable(item) ? 'opacity-80' : 'none'"
            :role="isActionable(item) ? 'button' : undefined"
            :aria-disabled="Boolean(openingId) || !isActionable(item)"
            @click="openNotification(item)"
          >
            <view
              class="h-avatar w-avatar flex shrink-0 items-center justify-center rounded-full"
              :class="notificationTone(item)"
            >
              <image class="h-glyph w-glyph" :src="notificationIcon(item)" mode="aspectFit" />
            </view>

            <view class="min-w-0 flex flex-1 flex-col gap-caption">
              <view class="flex items-center justify-between gap-sm">
                <text class="truncate text-body text-ink font-semibold leading-label">
                  {{ item.title }}
                </text>
                <text class="shrink-0 quiet-text">{{ notificationTime(item.createdAt) }}</text>
              </view>
              <view class="flex items-center justify-between gap-sm">
                <text class="truncate meta-text">{{ item.content }}</text>
                <view
                  v-if="!item.isRead"
                  class="h-dot w-dot shrink-0 rounded-full bg-brand"
                  aria-label="未读"
                />
              </view>
            </view>
          </view>
        </view>

        <text v-if="loadMoreError" class="mt-copy block text-center text-small text-danger">
          更多消息加载失败
        </text>
        <button
          v-if="hasMore"
          class="mx-page-horizontal mt-copy h-control border border-divider rounded-control bg-surface text-body text-muted"
          :disabled="loading || Boolean(openingId)"
          :aria-disabled="loading || Boolean(openingId)"
          :loading="loading"
          @click="loadNotifications(false)"
        >
          {{ loading ? "加载中" : "加载更多消息" }}
        </button>
      </template>
    </view>
  </MainTabLayout>
</template>
