<script setup lang="ts">
import { useSlots } from "vue";
import { getMainLayoutTop } from "./main-tab-layout";
import { getSubPageBottom } from "./sub-page-layout";

defineProps<{ title: string }>();

const slots = useSlots();
const windowInfo = uni.getWindowInfo();
/* eslint-disable prefer-const -- UniApp assigns this only in WeChat builds. */
let menuButton: { bottom: number } | undefined;

// #ifdef MP-WEIXIN
menuButton = uni.getMenuButtonBoundingClientRect();
// #endif
/* eslint-enable prefer-const */

const safeAreaTop = getMainLayoutTop(windowInfo, menuButton);
const safeAreaBottom = getSubPageBottom(windowInfo);

function goBack() {
  uni.navigateBack();
}
</script>

<template>
  <view class="h-screen min-h-screen flex flex-col overflow-hidden bg-page-bg text-ink">
    <view class="shrink-0" :style="{ height: `${safeAreaTop}px` }" />

    <view class="h-header flex shrink-0 items-center border-b border-divider bg-surface px-action">
      <view
        class="h-control w-control flex shrink-0 items-center justify-center"
        aria-label="返回"
        @click="goBack"
      >
        <image
          class="h-icon-sm w-icon-sm rotate-180"
          src="/static/main/chevron.svg"
          mode="aspectFit"
        />
      </view>
      <text class="min-w-0 flex-1 truncate text-center card-heading">{{ title }}</text>
      <view class="h-control w-control flex shrink-0 items-center justify-center">
        <slot name="header-right" />
      </view>
    </view>

    <scroll-view class="h-0 min-h-0 flex-1" scroll-y :show-scrollbar="false">
      <slot />
    </scroll-view>

    <view
      v-if="slots.actions"
      class="shrink-0 border-t border-divider bg-surface px-action pt-copy"
      :style="{ paddingBottom: `${safeAreaBottom + 12}px` }"
    >
      <slot name="actions" />
    </view>
  </view>
</template>
