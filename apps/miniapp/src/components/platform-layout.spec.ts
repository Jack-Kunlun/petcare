import { describe, expect, it } from "vitest";
import { calculatePlatformLayout, getBottomSafeAreaStyle } from "./platform-layout";

const baseInput = {
  navigationContentHeight: 48,
  navigationHorizontalGap: 16,
  tabBarHeight: 52,
  tabBarTopPadding: 8,
};

describe("calculatePlatformLayout", () => {
  it("uses a valid WeChat capsule and safe bottom", () => {
    const layout = calculatePlatformLayout({
      ...baseInput,
      platform: "mp-weixin",
      deviceType: "phone",
      windowInfo: {
        windowWidth: 390,
        windowHeight: 844,
        screenHeight: 844,
        statusBarHeight: 44,
        safeArea: { top: 44, bottom: 810 },
        safeAreaInsets: { top: 44, right: 0, left: 0 },
      },
      menuButtonRect: {
        top: 50,
        right: 374,
        bottom: 82,
        left: 287,
        width: 87,
        height: 32,
      },
    });

    expect(layout).toMatchObject({
      safeAreaTop: 44,
      navigationContentHeight: 44,
      navigationTotalHeight: 88,
      pageTopInset: 88,
      safeAreaBottom: 34,
      capsuleReservedWidth: 119,
      tabBarContentHeight: 60,
      tabBarTotalHeight: 94,
    });
  });

  it("falls back when the WeChat capsule is invalid", () => {
    const layout = calculatePlatformLayout({
      ...baseInput,
      platform: "mp-weixin",
      deviceType: "phone",
      windowInfo: {
        windowWidth: 390,
        windowHeight: 844,
        screenHeight: 844,
        statusBarHeight: 44,
        safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 },
      },
      menuButtonRect: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: 0,
        height: 0,
      },
    });

    expect(layout).toMatchObject({
      navigationContentHeight: 48,
      navigationTotalHeight: 92,
      pageTopInset: 92,
      safeAreaBottom: 34,
      capsuleReservedWidth: 0,
    });
  });

  it("uses the App iOS safe bottom", () => {
    const layout = calculatePlatformLayout({
      ...baseInput,
      platform: "app",
      deviceType: "phone",
      windowInfo: {
        windowWidth: 393,
        windowHeight: 852,
        screenHeight: 852,
        statusBarHeight: 47,
        safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
      },
    });

    expect(layout).toMatchObject({
      safeAreaTop: 47,
      navigationTotalHeight: 95,
      pageTopInset: 47,
      safeAreaBottom: 34,
      tabBarTotalHeight: 94,
    });
  });

  it("keeps the App Android safe bottom at zero", () => {
    const layout = calculatePlatformLayout({
      ...baseInput,
      platform: "app",
      deviceType: "phone",
      windowInfo: {
        windowWidth: 360,
        windowHeight: 800,
        screenHeight: 800,
        statusBarHeight: 24,
        safeAreaInsets: { top: 24, right: 0, bottom: 0, left: 0 },
      },
    });

    expect(layout.safeAreaBottom).toBe(0);
    expect(getBottomSafeAreaStyle(layout, 12)).toBe("12px");
  });

  it("uses CSS safe area only on mobile H5", () => {
    const layout = calculatePlatformLayout({
      ...baseInput,
      platform: "web",
      deviceType: "phone",
      windowInfo: {
        windowWidth: 390,
        windowHeight: 720,
        screenHeight: 844,
        statusBarHeight: 44,
        safeAreaInsets: { top: 44, right: 0, bottom: 34, left: 0 },
      },
    });

    expect(layout).toMatchObject({
      safeAreaTop: 0,
      pageTopInset: 0,
      safeAreaBottom: 0,
      usesCssSafeArea: true,
      windowHeight: 720,
    });
    expect(getBottomSafeAreaStyle(layout, 12)).toBe(
      "calc(12px + env(safe-area-inset-bottom, 0px))",
    );
  });

  it("keeps desktop H5 safe areas at zero", () => {
    const layout = calculatePlatformLayout({
      ...baseInput,
      platform: "web",
      deviceType: "pc",
      windowInfo: {
        windowWidth: 1440,
        windowHeight: 900,
        screenHeight: 900,
        statusBarHeight: 0,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });

    expect(layout).toMatchObject({
      safeAreaTop: 0,
      pageTopInset: 0,
      safeAreaBottom: 0,
      usesCssSafeArea: false,
    });
    expect(getBottomSafeAreaStyle(layout, 0)).toBe("0px");
  });
});
