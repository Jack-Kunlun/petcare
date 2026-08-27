<script setup lang="ts">
import { ref } from "vue";
import { usePlatformLayout } from "@/components/platform-layout";
import { miniappDesignTokens } from "@/config/design-tokens";
import { loginInteractively } from "@/state/session";

definePage({
  style: {
    navigationBarTextStyle: "black",
    navigationStyle: "custom",
  },
});

const { layout } = usePlatformLayout();
const loginPending = ref(false);
const loginComplete = ref(false);
const { colors, radii, sizes, fontSizes, lineHeights } = miniappDesignTokens;
const loginButtonStyle = [
  "width: 100%",
  `height: ${sizes.button}`,
  "margin: 0",
  "padding: 0",
  "border: none",
  `border-radius: ${radii.control}`,
  `background: ${colors.brand}`,
  `color: ${colors.surface}`,
  `font-size: ${fontSizes.button}`,
  "font-weight: 500",
  `line-height: ${lineHeights.button}`,
].join("; ");

const trustItems = [
  { icon: "/static/auth/check.svg", label: "宠物档案" },
  { icon: "/static/auth/heart.svg", label: "萌宠课堂" },
  { icon: "/static/auth/camera.svg", label: "受控社区" },
] as const;

async function handleLogin(): Promise<void> {
  if (loginPending.value) {
    return;
  }

  loginPending.value = true;

  try {
    if (!loginComplete.value) {
      try {
        await loginInteractively();
        loginComplete.value = true;
      } catch {
        await uni.showToast({ title: "登录失败，请稍后重试", icon: "none" });

        return;
      }
    }

    try {
      await uni.reLaunch({ url: "/pages/index/index" });
    } catch {
      await uni.showToast({
        title: "登录成功，但页面跳转失败，请再次点击进入首页",
        icon: "none",
      });
    }
  } finally {
    loginPending.value = false;
  }
}
</script>

<template>
  <scroll-view
    class="pc-platform-viewport flex flex-col bg-canvas text-ink"
    scroll-y
    enable-flex
    :show-scrollbar="false"
    :style="
      layout.platform === 'h5'
        ? undefined
        : { height: layout.windowHeight ? `${layout.windowHeight}px` : '100vh' }
    "
  >
    <view
      class="relative box-border h-hero flex shrink-0 overflow-hidden"
      :style="{ paddingTop: `${layout.pageTopInset}px` }"
    >
      <image
        class="absolute right-hero-bleed top-0 h-full w-hero-image"
        src="/static/main/community-pet-5.jpg"
        mode="aspectFill"
      />

      <image
        class="relative z-1 ml-screen mt-screen h-logo-height w-logo-width"
        src="/static/auth/petcare-logo.png"
        mode="aspectFit"
        aria-label="PetCare"
      />
    </view>

    <view
      class="relative z-1 mt--surface-overlap box-border flex flex-1 flex-col rounded-t-surface bg-surface px-screen pb-screen pt-section"
    >
      <view class="flex flex-col">
        <view class="flex flex-col gap-copy">
          <text class="block text-title font-medium leading-title"> 认真记录每一份陪伴 </text>
          <text class="block text-body text-muted leading-body">
            管理宠物档案，浏览养宠知识，分享真实日常。
          </text>
        </view>

        <view class="mt-section h-commitments flex">
          <view
            v-for="item in trustItems"
            :key="item.label"
            class="min-w-0 flex flex-1 flex-col items-center gap-copy"
          >
            <view
              class="h-icon w-icon flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft"
            >
              <image class="h-glyph w-glyph" :src="item.icon" mode="aspectFit" />
            </view>
            <text class="whitespace-nowrap text-body text-muted font-medium leading-label">
              {{ item.label }}
            </text>
          </view>
        </view>

        <view class="mt-statement flex items-end gap-copy">
          <view
            class="h-icon w-icon flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft"
          >
            <image class="h-glyph w-glyph" src="/static/auth/heart.svg" mode="aspectFit" />
          </view>
          <view class="min-w-0 flex flex-1 flex-col">
            <view class="flex flex-col text-body font-medium leading-label">
              <text>每一份档案，都由你维护。</text>
              <text>每一条动态，都经过内容治理。</text>
            </view>
            <text class="mt-caption block text-caption text-muted leading-caption">
              PetCare 陪你记录真实的养宠生活
            </text>
          </view>
        </view>
      </view>

      <view class="mt-actions flex flex-col items-center gap-action">
        <button
          :aria-disabled="loginPending"
          :disabled="loginPending"
          :loading="loginPending"
          :style="loginPending ? `${loginButtonStyle}; opacity: 0.6` : loginButtonStyle"
          class="box-border w-full flex items-center justify-center"
          hover-class="opacity-80"
          @click="handleLogin"
        >
          {{
            loginPending
              ? loginComplete
                ? "进入中…"
                : "登录中…"
              : loginComplete
                ? "进入首页"
                : "微信一键登录"
          }}
        </button>

        <view
          class="w-agreement flex flex-col items-center overflow-hidden whitespace-nowrap text-caption text-muted leading-caption"
        >
          <view class="flex items-center">
            <text>登录即代表你已阅读并同意</text>
            <navigator
              class="h-control flex items-center text-brand-active"
              url="/pages-content/legal/index?key=terms"
              aria-label="查看服务协议"
              hover-class="opacity-80"
            >
              <text>《服务协议》</text>
            </navigator>
          </view>
          <view class="flex items-center">
            <text>和</text>
            <navigator
              class="h-control flex items-center text-brand-active"
              url="/pages-content/legal/index?key=privacy"
              aria-label="查看隐私政策"
              hover-class="opacity-80"
            >
              <text>《隐私政策》</text>
            </navigator>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
