<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import type { WebsiteContactChannel, WebsiteContactPanelContent } from "@petcare/shared-types";
import { WEBSITE_CONTENT_KEY } from "@petcare/shared-types";
import { ref } from "vue";
import { getPublishedContent } from "@/api/content";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
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
      <PcStatePanel v-if="status === 'loading'" status="loading" title="客服信息加载中…" />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="客服信息加载失败"
        description="请检查网络后重试。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="load"
      />

      <PcStatePanel
        v-else-if="!panel"
        status="empty"
        title="暂无联系方式"
        description="已发布的联系方式会显示在这里。"
      />

      <template v-else>
        <view class="border border-border rounded-card bg-surface p-card">
          <text class="text-page text-ink font-semibold leading-page">{{ panel.title }}</text>
          <text v-if="panel.description" class="mt-sm block text-body text-muted leading-body">
            {{ panel.description }}
          </text>
        </view>

        <PcStatePanel
          v-if="panel.channels.length === 0"
          status="empty"
          title="暂无可用联系渠道"
          description="已发布的电话或邮箱会显示在这里。"
        />

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
          <PcButton
            v-if="getContactAction(channel.href).kind !== 'none'"
            class="mt-action"
            block
            :disabled="actionPending !== null"
            :loading="actionPending === channel.channelKey"
            :aria-label="`${getContactAction(channel.href).kind === 'phone' ? '拨打' : '复制'}${channel.label}`"
            @click="activateChannel(channel)"
          >
            {{ getContactAction(channel.href).kind === "phone" ? "拨打电话" : "复制邮箱" }}
          </PcButton>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
