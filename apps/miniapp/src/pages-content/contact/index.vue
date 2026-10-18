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

function contactIcon(channel: WebsiteContactChannel): string {
  return getContactAction(channel.href).kind === "phone"
    ? "/static/content/contact-phone.svg"
    : "/static/content/contact-chat.svg";
}

function openChatPreview(): void {
  uni.navigateTo({ url: "/pages-content/chat/index?mode=preview" });
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
        <view class="rounded-card bg-soft p-card">
          <text class="text-card text-ink font-semibold leading-card">{{ panel.title }}</text>
          <text v-if="panel.description" class="mt-sm block meta-text">
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
          class="flex items-center gap-copy main-card p-action"
        >
          <view class="h-control w-control flex shrink-0 items-center justify-center">
            <image
              class="h-glyph w-glyph"
              :src="contactIcon(channel)"
              mode="aspectFit"
              aria-hidden="true"
            />
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="card-heading">{{ channel.label }}</text>
            <text class="mt-caption block meta-text">{{ channel.value }}</text>
            <text v-if="channel.availability" class="mt-caption block quiet-text">
              {{ channel.availability }}
            </text>
          </view>
          <PcButton
            v-if="getContactAction(channel.href).kind !== 'none'"
            variant="secondary"
            :disabled="actionPending !== null"
            :loading="actionPending === channel.channelKey"
            :aria-label="`${getContactAction(channel.href).kind === 'phone' ? '拨打' : '复制'}${channel.label}`"
            @click="activateChannel(channel)"
          >
            {{ getContactAction(channel.href).kind === "phone" ? "拨打" : "复制" }}
          </PcButton>
        </view>

        <view class="flex items-center gap-copy main-card p-action">
          <view class="h-control w-control flex shrink-0 items-center justify-center">
            <image
              class="h-glyph w-glyph"
              src="/static/content/contact-chat.svg"
              mode="aspectFit"
              aria-hidden="true"
            />
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="card-heading">聊天界面预览</text>
            <text class="mt-caption block meta-text">静态页面，不提供实时客服</text>
          </view>
          <PcButton variant="secondary" @click="openChatPreview">查看</PcButton>
        </view>

        <view class="mt-section">
          <text class="section-heading">服务说明</text>
          <text class="mt-copy block meta-text">
            咨询订单、账号与宠物资料问题时，请准备相关页面信息。可用联系方式以本页已发布内容为准。
          </text>
        </view>
      </template>
    </view>
  </SubPageLayout>
</template>
