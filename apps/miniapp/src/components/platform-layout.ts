import { onMounted, onUnmounted, ref } from "vue";
import { miniappDesignTokens } from "../config/design-tokens";

interface SafeAreaInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

interface PlatformWindowInfo {
  windowWidth: number;
  windowHeight: number;
  screenHeight: number;
  statusBarHeight?: number;
  safeArea?: { top?: number; right?: number; bottom?: number; left?: number };
  safeAreaInsets?: SafeAreaInsets;
}

interface MenuButtonRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface PlatformLayoutInput {
  platform: string;
  deviceType: string;
  windowInfo: PlatformWindowInfo;
  menuButtonRect?: MenuButtonRect;
  navigationContentHeight: number;
  navigationHorizontalGap: number;
  tabBarHeight: number;
  tabBarTopPadding: number;
}

export interface PlatformLayout {
  platform: string;
  windowWidth: number;
  windowHeight: number;
  statusBarHeight: number;
  safeAreaTop: number;
  safeAreaRight: number;
  safeAreaBottom: number;
  safeAreaLeft: number;
  navigationContentHeight: number;
  navigationTotalHeight: number;
  pageTopInset: number;
  menuButtonRect?: MenuButtonRect;
  capsuleReservedWidth: number;
  tabBarContentHeight: number;
  tabBarTotalHeight: number;
  usesCssSafeArea: boolean;
}

function nonNegative(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function hasValidMenuButton(
  rect: MenuButtonRect | undefined,
  windowWidth: number,
): rect is MenuButtonRect {
  return Boolean(
    rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > rect.top &&
    rect.right > rect.left &&
    rect.left >= 0 &&
    rect.right <= windowWidth,
  );
}

function normalizePlatform(platform: string) {
  if (platform === "app") {
    return "app-plus";
  }

  if (platform === "web") {
    return "h5";
  }

  return platform;
}

function getSafeAreaBottom(
  isWeb: boolean,
  screenHeight: number,
  safeArea: PlatformWindowInfo["safeArea"],
  safeAreaInsets: SafeAreaInsets | undefined,
) {
  if (isWeb) {
    return 0;
  }

  if (safeAreaInsets?.bottom !== undefined && Number.isFinite(safeAreaInsets.bottom)) {
    return nonNegative(safeAreaInsets.bottom);
  }

  if (safeArea?.bottom !== undefined && Number.isFinite(safeArea.bottom)) {
    return Math.max(0, nonNegative(screenHeight) - safeArea.bottom);
  }

  return 0;
}

function getSafeAreaRight(
  isWeb: boolean,
  windowWidth: number,
  safeArea: PlatformWindowInfo["safeArea"],
  safeAreaInsets: SafeAreaInsets | undefined,
) {
  if (isWeb) {
    return 0;
  }

  if (safeAreaInsets?.right !== undefined) {
    return nonNegative(safeAreaInsets.right);
  }

  return safeArea?.right === undefined ? 0 : Math.max(0, windowWidth - safeArea.right);
}

export function calculatePlatformLayout(input: PlatformLayoutInput): PlatformLayout {
  const {
    deviceType,
    menuButtonRect,
    navigationContentHeight: fallbackNavigationContentHeight,
    navigationHorizontalGap,
    platform: runtimePlatform,
    tabBarHeight,
    tabBarTopPadding,
    windowInfo,
  } = input;
  const {
    safeArea,
    safeAreaInsets,
    screenHeight,
    statusBarHeight: runtimeStatusBarHeight,
    windowHeight,
    windowWidth,
  } = windowInfo;
  const platform = normalizePlatform(runtimePlatform);
  const isWeb = platform === "h5";
  const isWeChat = platform === "mp-weixin";
  const statusBarHeight = isWeb ? 0 : nonNegative(runtimeStatusBarHeight);
  const safeAreaTop = isWeb
    ? 0
    : Math.max(statusBarHeight, nonNegative(safeAreaInsets?.top), nonNegative(safeArea?.top));
  const safeAreaBottom = getSafeAreaBottom(isWeb, screenHeight, safeArea, safeAreaInsets);
  const menuButton =
    isWeChat && hasValidMenuButton(menuButtonRect, windowWidth) ? menuButtonRect : undefined;
  const navigationContentHeight = menuButton
    ? menuButton.height + Math.max(0, menuButton.top - statusBarHeight) * 2
    : fallbackNavigationContentHeight;
  const navigationTotalHeight =
    (isWeChat ? statusBarHeight : safeAreaTop) + navigationContentHeight;
  const tabBarContentHeight = tabBarHeight + tabBarTopPadding;

  return {
    platform,
    windowWidth: nonNegative(windowWidth),
    windowHeight: nonNegative(windowHeight),
    statusBarHeight,
    safeAreaTop,
    safeAreaRight: getSafeAreaRight(isWeb, windowWidth, safeArea, safeAreaInsets),
    safeAreaBottom,
    safeAreaLeft: isWeb ? 0 : nonNegative(safeAreaInsets?.left ?? safeArea?.left),
    navigationContentHeight,
    navigationTotalHeight,
    pageTopInset: isWeChat ? navigationTotalHeight : safeAreaTop,
    menuButtonRect: menuButton,
    capsuleReservedWidth: menuButton
      ? Math.max(0, windowWidth - menuButton.left + navigationHorizontalGap)
      : 0,
    tabBarContentHeight,
    tabBarTotalHeight: tabBarContentHeight + safeAreaBottom,
    usesCssSafeArea: isWeb && (deviceType === "phone" || deviceType === "pad"),
  };
}

export function getBottomSafeAreaStyle(layout: PlatformLayout, base: number) {
  const safeBase = nonNegative(base);

  if (!layout.usesCssSafeArea) {
    return `${safeBase + layout.safeAreaBottom}px`;
  }

  return safeBase === 0
    ? "env(safe-area-inset-bottom, 0px)"
    : `calc(${safeBase}px + env(safe-area-inset-bottom, 0px))`;
}

function readPlatformLayout() {
  const systemInfo = uni.getSystemInfoSync();
  const windowInfo = uni.getWindowInfo();
  /* eslint-disable prefer-const -- UniApp assigns this only in WeChat builds. */
  let menuButtonRect: MenuButtonRect | undefined;

  // #ifdef MP-WEIXIN
  menuButtonRect = uni.getMenuButtonBoundingClientRect();
  // #endif
  /* eslint-enable prefer-const */

  return calculatePlatformLayout({
    platform: systemInfo.uniPlatform,
    deviceType: systemInfo.deviceType,
    windowInfo,
    menuButtonRect,
    navigationContentHeight: Number.parseFloat(miniappDesignTokens.sizes.header),
    navigationHorizontalGap: Number.parseFloat(miniappDesignTokens.spacing.action),
    tabBarHeight: Number.parseFloat(miniappDesignTokens.sizes.tabbar),
    tabBarTopPadding: Number.parseFloat(miniappDesignTokens.spacing.sm),
  });
}

export function usePlatformLayout() {
  const layout = ref(readPlatformLayout());
  const refresh = () => {
    layout.value = readPlatformLayout();
  };

  onMounted(() => uni.onWindowResize(refresh));
  onUnmounted(() => uni.offWindowResize(refresh));

  return { layout, refresh };
}
