import { describe, expect, it } from "vitest";
import { isMainlandChinaMobile } from "./profile-form";

describe("profile form", () => {
  it("accepts only Mainland China mobile numbers", () => {
    expect(isMainlandChinaMobile("13800138000")).toBe(true);
    expect(isMainlandChinaMobile(" 13800138000 ")).toBe(false);
    expect(isMainlandChinaMobile("12679141878")).toBe(false);
    expect(isMainlandChinaMobile("1767914187")).toBe(false);
  });
});
