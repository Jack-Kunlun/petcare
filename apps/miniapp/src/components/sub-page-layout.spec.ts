import { describe, expect, it } from "vitest";
import { getSubPageBottom } from "./sub-page-layout";

describe("getSubPageBottom", () => {
  it("uses the platform safe-area bottom with a zero fallback", () => {
    expect(getSubPageBottom({ safeAreaInsets: { bottom: 34 } })).toBe(34);
    expect(getSubPageBottom({})).toBe(0);
  });
});
