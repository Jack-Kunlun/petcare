import { describe, expect, it } from "vitest";
import { getMainLayoutTop } from "./main-tab-layout";

describe("getMainLayoutTop", () => {
  it("starts page content below the WeChat capsule", () => {
    expect(
      getMainLayoutTop({ statusBarHeight: 44, safeAreaInsets: { top: 44 } }, { bottom: 80 }),
    ).toBe(80);
  });

  it("uses the safe-area top on H5 and App", () => {
    expect(getMainLayoutTop({ statusBarHeight: 24, safeAreaInsets: { top: 24 } }, undefined)).toBe(
      24,
    );
  });
});
