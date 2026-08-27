<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { WebsiteContactChannel, WebsiteContactPanelContent } from "@petcare/shared-types";
import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { ref } from "vue";
import { getPublishedContent } from "@/api/content";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getContactAction, toContactPanel } from "@/pages-content/content-mappers";

const panel = ref<WebsiteContactPanelContent | null>(null);
const status = ref<"loading" | "ready" | "error">("loading");
const loading = ref(false);
const actionPending = ref<string | null>(null);

async function load(): Promise<void> {
  if (loading.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";

  try {
    panel.value = toContactPanel(await getPublishedContent(WEBSITE_CONTENT_KEY.CONTACT));
    status.value = "ready";
  } catch {
    status.value = "error";
  } finally {
    loading.value = false;
  }
}

async function activateChannel(channel: WebsiteContactChannel): Promise<void> {
  const action = getContactAction(channel.href);

  if (action.kind === "none" || actionPending.value !== null) {
    return;
  }

  actionPending.value = channel.channelKey;

  try {
    if (action.kind === "phone") {
      await uni.makePhoneCall({ phoneNumber: action.value });
    } else {
      await uni.setClipboardData({ data: action.value });
      await uni.showToast({ title: "邮箱已复制", icon: "success" });
    }
  } catch {
    await uni.showToast({ title: "操作失败，请重试", icon: "none" }).catch(() => undefined);
  } finally {
    actionPending.value = null;
  }
}

onLoad(() => {
  void load();
});
</script>

<template>
  <SubPageLayout title="联系客服">
    <view class="flex flex-col gap-copy px-action py-card">
      <view v-if="status === 'loading'" class="main-card p-action">
        <text class="text-body text-muted leading-body">客服信息加载中…</text>
      </view>

      <view
        v-else-if="status === 'error'"
        class="flex flex-col gap-copy rounded-card bg-danger-soft p-action"
        role="alert"
      >
        <text class="text-body text-ink leading-body">客服信息加载失败，请稍后重试</text>
        <button
          class="h-control rounded-control bg-brand-active px-action text-body text-surface font-medium"
          :class="loading ? 'opacity-50' : ''"
          :disabled="loading"
          :aria-disabled="loading"
          :loading="loading"
          @click="load"
        >
          重新加载
        </button>
      </view>

      <view v-else-if="!panel" class="main-card p-action">
        <text class="text-body text-muted leading-body">客服信息暂未配置</text>
      </view>

      <template v-else>
        <view class="border border-border rounded-card bg-surface p-card">
          <text class="text-page text-ink font-semibold leading-page">{{ panel.title }}</text>
          <text v-if="panel.description" class="mt-sm block text-body text-muted leading-body">
            {{ panel.description }}
          </text>
        </view>

        <view v-if="panel.channels.length === 0" class="main-card p-action">
          <text class="text-body text-muted leading-body">客服渠道暂未配置</text>
        </view>

        <view
          v-for="channel in panel.channels"
          :key="channel.channelKey"
          class="main-card p-action"
        >
          <text class="card-heading">{{ channel.label }}</text>
          <text class="mt-copy block text-section text-ink font-semibold leading-section">
            {{ channel.value }}
          </text>
          <text v-if="channel.availability" class="mt-sm block meta-text">
            {{ channel.availability }}
          </text>
          <button
            v-if="getContactAction(channel.href).kind !== 'none'"
            class="mt-action h-control flex items-center justify-center rounded-control bg-brand-active"
            :class="actionPending !== null ? 'opacity-50' : ''"
            :disabled="actionPending !== null"
            :aria-disabled="actionPending !== null"
            :loading="actionPending === channel.channelKey"
            :aria-label="`${getContactAction(channel.href).kind === 'phone' ? '拨打' : '复制'}${channel.label}`"
            @click="activateChannel(channel)"
          >
            <text class="text-body text-surface font-medium leading-label">
              {{ getContactAction(channel.href).kind === "phone" ? "拨打电话" : "复制邮箱" }}
            </text>
          </button>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
