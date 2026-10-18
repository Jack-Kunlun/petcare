<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import PcButton from "@/components/PcButton.vue";
import { getBottomSafeAreaStyle, usePlatformLayout } from "@/components/platform-layout";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const { layout } = usePlatformLayout();
const mode = ref<"preview" | "service" | "photo">("preview");
const draft = ref("");

function goBack(): void {
  uni.navigateBack();
}

function showAttachmentNotice(): void {
  uni.showActionSheet({
    itemList: ["查看图片消息", "查看文字消息"],
    success: ({ tapIndex }) => {
      mode.value = tapIndex === 0 ? "photo" : "preview";
    },
  });
}

function previewPhoto(): void {
  uni.previewImage({
    current: "/static/content/chat-pet-photo.webp",
    urls: ["/static/content/chat-pet-photo.webp"],
  });
}

function saveDraft(): void {
  const value = draft.value.trim();

  if (!value) {
    return;
  }

  draft.value = value;
  uni.showToast({ title: "草稿仅保留在本页，不会发送", icon: "none" });
}

onLoad((query = {}) => {
  if (query.mode === "service" || query.mode === "photo") {
    mode.value = query.mode;
  }
});
</script>

<template>
  <view
    class="pc-platform-viewport flex flex-col overflow-hidden bg-canvas text-ink"
    :style="
      layout.platform === 'h5'
        ? undefined
        : { height: layout.windowHeight ? `${layout.windowHeight}px` : '100vh' }
    "
  >
    <view
      class="shrink-0 bg-surface"
      :style="{ height: `${layout.navigationTotalHeight - layout.navigationContentHeight}px` }"
    />

    <view
      class="flex shrink-0 items-center gap-copy bg-surface px-action"
      :style="{
        height: `${layout.navigationContentHeight}px`,
        paddingRight: layout.capsuleReservedWidth ? `${layout.capsuleReservedWidth}px` : undefined,
      }"
    >
      <button
        class="h-control w-control flex shrink-0 items-center justify-center border-0 bg-transparent p-0"
        aria-label="返回"
        @click="goBack"
      >
        <image class="h-glyph w-glyph" src="/static/content/chat-back.svg" mode="aspectFit" />
      </button>
      <image
        class="h-avatar-sm w-avatar-sm rounded-full"
        src="/static/content/chat-caregiver.png"
        mode="aspectFill"
      />
      <view class="min-w-0 flex flex-1 flex-col">
        <text class="truncate text-body text-ink font-semibold leading-label">小林</text>
      </view>
    </view>
    <view class="h-px shrink-0 bg-divider" />

    <scroll-view class="h-0 min-h-0 flex-1 bg-page-bg" scroll-y :show-scrollbar="false">
      <view class="flex flex-col gap-copy px-action py-action">
        <text class="text-center quiet-text">静态会话预览 · 不会发送消息</text>
        <view v-if="mode === 'service'" class="flex items-center gap-copy main-card p-copy">
          <image
            class="h-avatar w-avatar rounded-full"
            src="/static/content/chat-pet-avatar.png"
            mode="aspectFill"
          />
          <view class="min-w-0 flex flex-1 flex-col">
            <text class="text-body text-ink font-medium leading-label">咪咪 · 上门喂养</text>
            <text class="quiet-text">服务卡片静态预览</text>
          </view>
          <text class="rounded-pill bg-soft px-copy py-caption text-caption text-brand-active">
            静态
          </text>
        </view>

        <text class="my-caption text-center quiet-text">今天 14:20</text>

        <template v-if="mode !== 'photo'">
          <view class="flex items-end gap-copy">
            <image
              class="h-avatar-sm w-avatar-sm shrink-0 rounded-full"
              src="/static/content/chat-caregiver.png"
              mode="aspectFill"
            />
            <text
              class="max-w-[80%] rounded-card bg-surface px-copy py-copy text-body text-ink leading-body"
            >
              你好，今天 14:00 到达可以吗？
            </text>
          </view>
          <view class="flex justify-end">
            <text
              class="max-w-[80%] rounded-card bg-soft px-copy py-copy text-body text-brand-active leading-body"
            >
              可以的，我会提前把门禁信息发给你。
            </text>
          </view>
          <text class="my-caption text-center quiet-text">小林已到达服务地址</text>
          <view class="flex items-end gap-copy">
            <image
              class="h-avatar-sm w-avatar-sm shrink-0 rounded-full"
              src="/static/content/chat-caregiver.png"
              mode="aspectFill"
            />
            <text
              class="max-w-[80%] rounded-card bg-surface px-copy py-copy text-body text-ink leading-body"
            >
              我已经到达啦，咪咪现在很放松。
            </text>
          </view>
          <view class="flex justify-end">
            <text
              class="max-w-[80%] rounded-card bg-soft px-copy py-copy text-body text-brand-active leading-body"
            >
              谢谢，麻烦喂完后拍张照片给我。
            </text>
          </view>
        </template>

        <template v-else>
          <view class="flex items-end gap-copy">
            <image
              class="h-avatar-sm w-avatar-sm shrink-0 rounded-full"
              src="/static/content/chat-caregiver.png"
              mode="aspectFill"
            />
            <text
              class="max-w-[80%] rounded-card bg-surface px-copy py-copy text-body text-ink leading-body"
            >
              咪咪已经吃完啦，精神也很好。
            </text>
          </view>
          <view class="flex items-start gap-copy">
            <image
              class="h-avatar-sm w-avatar-sm shrink-0 rounded-full"
              src="/static/content/chat-caregiver.png"
              mode="aspectFill"
            />
            <view class="flex flex-col gap-caption">
              <image
                class="h-hero-main w-[220px] rounded-card"
                src="/static/content/chat-pet-photo.webp"
                mode="aspectFill"
                aria-label="预览消息图片"
                @click="previewPhoto"
              />
              <text class="quiet-text">图片示例 · 本地静态内容</text>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>

    <view
      class="shrink-0 border-t border-divider bg-surface px-action pt-copy"
      :style="{ paddingBottom: getBottomSafeAreaStyle(layout, 12) }"
    >
      <view class="flex items-center gap-copy">
        <button
          class="h-control w-control flex shrink-0 items-center justify-center border-0 bg-transparent p-0"
          aria-label="添加附件"
          @click="showAttachmentNotice"
        >
          <image class="h-glyph w-glyph" src="/static/content/chat-plus.svg" mode="aspectFit" />
        </button>
        <input
          v-model="draft"
          class="h-control min-w-0 flex-1 rounded-pill bg-page-bg px-copy text-body text-ink"
          aria-label="本地消息草稿"
          placeholder="输入消息…"
          confirm-type="done"
          @confirm="saveDraft"
        />
        <PcButton
          variant="ghost"
          :disabled="draft.trim().length === 0"
          aria-label="保存本地草稿"
          @click="saveDraft"
        >
          保存
        </PcButton>
      </view>
    </view>
  </view>
</template>
