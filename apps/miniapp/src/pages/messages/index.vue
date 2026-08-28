<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "@petcare/shared-types";
import type { NotificationCategory, UserNotification } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { getMessageTarget } from "./message-route";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications";
import MainTabLayout from "@/components/MainTabLayout.vue";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const PAGE_SIZE = 20;
const categoryTabs: ReadonlyArray<{
  label: string;
  value: NotificationCategory;
}> = [
  { label: "系统通知", value: NOTIFICATION_CATEGORY.SYSTEM },
  { label: "互动消息", value: NOTIFICATION_CATEGORY.INTERACTION },
];

const notifications = ref<UserNotification[]>([]);
const activeCategory = ref<NotificationCategory>(NOTIFICATION_CATEGORY.INTERACTION);
const status = ref<"loading" | "ready" | "error" | "unauthenticated">("loading");
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

  return "/static/main/bell.svg";
}

function notificationTone(item: UserNotification): string {
  if (item.type === NOTIFICATION_TYPE.COMMUNITY_LIKE) {
    return "bg-danger-soft";
  }

  return "bg-soft";
}

function notificationTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function isActionable(item: UserNotification): boolean {
  return Boolean(getMessageTarget(item.category, item.referenceId));
}

async function loadNotifications(reset = true): Promise<void> {
  if (!session.user) {
    notifications.value = [];
    total.value = 0;
    status.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  if (loading.value) {
    return;
  }

  loading.value = true;
  loadMoreError.value = false;

  if (reset) {
    status.value = "loading";
  }

  const startedAt = captureSessionUserRevision();

  try {
    const nextPage = reset ? 1 : page.value + 1;
    const response = await getNotifications({
      page: nextPage,
      pageSize: PAGE_SIZE,
      category: activeCategory.value,
    });

    if (!isSessionUserRevisionCurrent(startedAt)) {
      notifications.value = [];
      total.value = 0;
      status.value = "unauthenticated";

      return;
    }

    notifications.value = reset ? response.list : [...notifications.value, ...response.list];
    page.value = response.page;
    total.value = response.total;
    status.value = "ready";
  } catch {
    if (!isSessionUserRevisionCurrent(startedAt)) {
      notifications.value = [];
      total.value = 0;
      status.value = "unauthenticated";

      return;
    }

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

function selectCategory(category: NotificationCategory): void {
  if (loading.value || activeCategory.value === category) {
    return;
  }

  activeCategory.value = category;
  void loadNotifications();
}

async function markAllRead(): Promise<void> {
  if (!session.user || markAllDisabled.value) {
    return;
  }

  markingAll.value = true;

  try {
    await markAllNotificationsRead();
    notifications.value = notifications.value.map((item) => ({ ...item, isRead: true }));
  } catch {
    if (!session.user) {
      status.value = "unauthenticated";

      return;
    }

    uni.showToast({ title: "全部已读失败，请重试", icon: "none" });
  } finally {
    markingAll.value = false;
  }
}

async function openNotification(item: UserNotification): Promise<void> {
  if (!session.user) {
    status.value = "unauthenticated";

    return;
  }

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
    if (!session.user) {
      status.value = "unauthenticated";
    } else {
      uni.showToast({ title: "消息暂时无法打开", icon: "none" });
    }
  } finally {
    openingId.value = null;
  }
}

onShow(() => void loadNotifications());

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped) {
      void loadNotifications();
    }
  },
);
</script>

<template>
  <MainTabLayout active="messages">
    <template #header>
      <view class="flex items-center justify-between">
        <text class="page-heading">消息</text>
        <PcButton
          v-if="hasUnread"
          variant="ghost"
          size="control"
          :loading="markingAll"
          :disabled="markAllDisabled"
          aria-label="全部已读"
          @click="markAllRead"
        >
          {{ markingAll ? "处理中" : "全部已读" }}
        </PcButton>
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

      <view
        v-if="status !== 'ready' || notifications.length === 0"
        class="mx-page-horizontal mt-card"
      >
        <PcStatePanel v-if="status === 'loading'" status="loading" title="消息加载中…" />
        <PcStatePanel
          v-else-if="status === 'unauthenticated'"
          status="unauthenticated"
          title="登录后查看消息"
          description="登录后可查看与你相关的互动与系统通知。"
          primary-label="微信登录"
          @primary="openLogin"
        />
        <PcStatePanel
          v-else-if="status === 'error'"
          status="error"
          title="消息加载失败"
          description="请检查网络后重试，已有消息不会被删除。"
          primary-label="重新加载"
          :primary-disabled="loading"
          @primary="loadNotifications()"
        />
        <PcStatePanel
          v-else-if="notifications.length === 0"
          status="empty"
          title="暂无消息"
          description="新的互动和系统通知会显示在这里。"
        />
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
        <PcButton
          v-if="hasMore"
          class="mx-page-horizontal mt-copy"
          block
          variant="secondary"
          :disabled="loading || Boolean(openingId)"
          :loading="loading"
          @click="loadNotifications(false)"
        >
          {{ loading ? "加载中" : "加载更多消息" }}
        </PcButton>
      </template>
    </view>
  </MainTabLayout>
</template>
