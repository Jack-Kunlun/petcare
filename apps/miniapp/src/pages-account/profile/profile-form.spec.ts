import { describe, expect, it } from "vitest";
import { isMainlandChinaMobile, isProfileFormDirty, mergeProfileResponse } from "./profile-form";

const current = {
  id: "user-1",
  nickname: "正在输入的昵称",
  avatar: "old-avatar",
  phoneMasked: null,
  profileComplete: false,
  userType: "pet_owner",
  region: "正在输入的地区",
  bio: "正在输入的简介",
};

const response = {
  ...current,
  nickname: "服务端旧昵称",
  avatar: "new-avatar",
  phoneMasked: "138****8000",
  profileComplete: true,
  region: "服务端旧地区",
  bio: "服务端旧简介",
};

describe("profile form", () => {
  it("accepts only Mainland China mobile numbers", () => {
    expect(isMainlandChinaMobile("13800138000")).toBe(true);
    expect(isMainlandChinaMobile(" 13800138000 ")).toBe(false);
    expect(isMainlandChinaMobile("12679141878")).toBe(false);
    expect(isMainlandChinaMobile("1767914187")).toBe(false);
  });

  it("enables saving only after an editable profile field changes", () => {
    const persisted = { nickname: "小白家长", region: "上海市", bio: "喜欢猫咪" };

    expect(isProfileFormDirty({ ...persisted }, persisted)).toBe(false);
    expect(isProfileFormDirty({ ...persisted, nickname: "小黑家长" }, persisted)).toBe(true);
    expect(isProfileFormDirty({ ...persisted, region: "杭州市" }, persisted)).toBe(true);
    expect(isProfileFormDirty({ ...persisted, bio: "喜欢狗狗" }, persisted)).toBe(true);
  });

  it("merges only fields owned by the completed operation", () => {
    expect(mergeProfileResponse(current, response, "avatar")).toEqual({
      ...current,
      avatar: "new-avatar",
    });
    expect(mergeProfileResponse(current, response, "save")).toEqual({
      ...current,
      nickname: "服务端旧昵称",
      region: "服务端旧地区",
      bio: "服务端旧简介",
    });
    expect(mergeProfileResponse(current, response, "bind")).toEqual({
      ...current,
      phoneMasked: "138****8000",
      profileComplete: true,
    });
  });
});
