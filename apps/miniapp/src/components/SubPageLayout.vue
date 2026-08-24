<script setup lang="ts">
import { computed, useSlots } from "vue";
import { getBottomSafeAreaStyle, usePlatformLayout } from "./platform-layout";
import { miniappDesignTokens } from "@/config/design-tokens";

defineProps<{ title: string }>();

const slots = useSlots();
const { layout } = usePlatformLayout();
const navigationHorizontalGap = Number.parseFloat(miniappDesignTokens.spacing.action);
const navigationControlSize = Number.parseFloat(miniappDesignTokens.sizes.control);
const actionPadding = Number.parseFloat(miniappDesignTokens.spacing.copy);
const rightControlOffset = computed(() =>
  Math.max(navigationHorizontalGap, layout.value.capsuleReservedWidth),
);
const titleInset = computed(() =>
  Math.max(
    navigationHorizontalGap + navigationControlSize,
    rightControlOffset.value + (slots["header-right"] ? navigationControlSize : 0),
  ),
);

function goBack() {
  uni.navigateBack();
}
</script>

<template>
  <view
    class="pc-platform-viewport flex flex-col overflow-hidden bg-page-bg text-ink"
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
      class="relative flex shrink-0 items-center bg-page-bg"
      :style="{ height: `${layout.navigationContentHeight}px` }"
    >
      <view
        class="absolute h-control w-control flex items-center justify-center"
        :style="{ left: `${navigationHorizontalGap}px` }"
        aria-label="返回"
        @click="goBack"
      >
        <image class="h-icon-sm w-icon-sm" src="/static/main/chevron-left.svg" mode="aspectFit" />
      </view>
      <text
        class="absolute truncate text-center card-heading"
        :style="{ left: `${titleInset}px`, right: `${titleInset}px` }"
      >
        {{ title }}
      </text>
      <view
        v-if="slots['header-right']"
        class="absolute h-control w-control flex items-center justify-center"
        :style="{ right: `${rightControlOffset}px` }"
      >
        <slot name="header-right" />
      </view>
    </view>

    <scroll-view class="h-0 min-h-0 flex-1" scroll-y :show-scrollbar="false">
      <slot />
    </scroll-view>

    <view
      v-if="slots.actions"
      class="shrink-0 border-t border-divider bg-surface px-action pt-copy"
      :style="{ paddingBottom: getBottomSafeAreaStyle(layout, actionPadding) }"
    >
      <slot name="actions" />
    </view>
  </view>
</template>
