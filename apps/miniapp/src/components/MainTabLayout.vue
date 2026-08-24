<script setup lang="ts">
import { computed } from "vue";
import { getBottomSafeAreaStyle, usePlatformLayout } from "./platform-layout";
import { miniappDesignTokens } from "@/config/design-tokens";

type MainTabKey = "home" | "bounty" | "community" | "messages" | "profile";

defineProps<{
  active: MainTabKey;
}>();

const { colors, spacing, sizes, fontSizes, lineHeights } = miniappDesignTokens;
const { layout } = usePlatformLayout();
const floatingGap = Number.parseFloat(spacing.action);
const rootHeaderRightInset = computed(() =>
  Math.max(floatingGap, layout.value.capsuleReservedWidth),
);
const tabbarStyle = [
  `--wot-tabbar-height: ${sizes.tabbar}`,
  `--wot-tabbar-bg: ${colors.surface}`,
  `--wot-tabbar-item-title-font-size: ${fontSizes.caption}`,
  `--wot-tabbar-item-title-line-height: ${lineHeights.caption}`,
].join("; ");

const tabs = [
  {
    key: "home",
    label: "首页",
    route: "/pages/index/index",
    icon: "/static/main/tab-home.svg",
    activeIcon: "/static/main/tab-home-active.svg",
    badge: undefined,
  },
  {
    key: "bounty",
    label: "悬赏",
    route: "/pages/bounty/index",
    icon: "/static/main/tab-bounty.svg",
    activeIcon: "/static/main/tab-bounty-active.svg",
    badge: undefined,
  },
  {
    key: "community",
    label: "社区",
    route: "/pages/community/index",
    icon: "/static/main/tab-community.svg",
    activeIcon: "/static/main/tab-community-active.svg",
    badge: undefined,
  },
  {
    key: "messages",
    label: "消息",
    route: "/pages/messages/index",
    icon: "/static/main/tab-messages.svg",
    activeIcon: "/static/main/tab-messages-active.svg",
    badge: 3,
  },
  {
    key: "profile",
    label: "我的",
    route: "/pages/profile/index",
    icon: "/static/main/tab-profile.svg",
    activeIcon: "/static/main/tab-profile-active.svg",
    badge: undefined,
  },
] as const;

function handleTabChange(event: { value: string | number }) {
  const tab = tabs.find((item) => item.key === event.value);

  if (tab) {
    uni.redirectTo({ url: tab.route });
  }
}
</script>

<template>
  <view
    class="pc-platform-viewport relative flex flex-col overflow-hidden bg-page-bg text-ink"
    :style="
      layout.platform === 'h5'
        ? undefined
        : { height: layout.windowHeight ? `${layout.windowHeight}px` : '100vh' }
    "
  >
    <view
      class="shrink-0 bg-page-bg"
      :style="{ height: `${layout.navigationTotalHeight - layout.navigationContentHeight}px` }"
    />

    <view
      class="box-border flex shrink-0 items-center bg-page-bg pl-page-horizontal"
      :style="{
        height: `${layout.navigationContentHeight}px`,
        paddingRight: `${rootHeaderRightInset}px`,
      }"
    >
      <view class="min-w-0 w-full">
        <slot name="header" />
      </view>
    </view>

    <scroll-view class="h-0 min-h-0 flex-1" scroll-y :show-scrollbar="false">
      <slot />
    </scroll-view>

    <view
      v-if="$slots.floating"
      class="pointer-events-none absolute right-action z-10"
      :style="{
        bottom: getBottomSafeAreaStyle(layout, layout.tabBarContentHeight + floatingGap),
      }"
    >
      <slot name="floating" />
    </view>

    <view
      class="shrink-0 border-t border-border bg-surface pt-sm"
      :style="{ paddingBottom: getBottomSafeAreaStyle(layout, 0) }"
    >
      <wd-tabbar
        :active-color="colors.brand"
        :bordered="false"
        :custom-style="tabbarStyle"
        :inactive-color="colors.subtle"
        :model-value="active"
        @change="handleTabChange"
      >
        <wd-tabbar-item v-for="tab in tabs" :key="tab.key" :name="tab.key" :title="tab.label">
          <template #icon="{ active: isActive }">
            <view class="relative mb-caption h-icon-md w-icon-md flex items-center justify-center">
              <image
                class="h-glyph w-glyph"
                :src="isActive ? tab.activeIcon : tab.icon"
                mode="aspectFit"
              />
              <view
                v-if="tab.badge"
                class="absolute right-0 top-0 h-icon-xs w-icon-xs flex items-center justify-center rounded-full bg-danger"
              >
                <text class="text-micro text-surface font-medium leading-badge">
                  {{ tab.badge }}
                </text>
              </view>
            </view>
          </template>
        </wd-tabbar-item>
      </wd-tabbar>
    </view>
  </view>
</template>
