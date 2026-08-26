import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "edit.vue"), "utf8");

describe("profile edit interaction boundary", () => {
  it("uses one busy owner across load, avatar, save, code, and bind actions", () => {
    expect(source).toContain(
      'const busy = ref<"load" | "avatar" | "save" | "code" | "bind" | null>',
    );
    expect(source).toContain(':disabled="busy !== null"');
    expect(source).toContain(':aria-disabled="busy !== null"');
    expect(source).toContain(
      "const phoneCodeDisabled = computed(() => busy.value !== null || countdown.value > 0)",
    );
    expect(source).toContain(':disabled="phoneCodeDisabled"');
    expect(source).toMatch(
      /function chooseImage\(\)[\s\S]*busy\.value = "avatar";[\s\S]*uni\.chooseImage/,
    );
  });

  it("shows a retryable initial error instead of an empty profile", () => {
    expect(source).toContain('const loadError = ref("")');
    expect(source).toContain('v-if="loadError && !profile"');
    expect(source).toContain('@click="loadProfile"');
  });

  it("uses a native disabled button for the H5 and App avatar fallback", () => {
    const fallback = source.match(/<!-- #ifndef MP-WEIXIN -->([\s\S]*?)<!-- #endif -->/)?.[1];

    expect(fallback).toContain("<button");
    expect(fallback).toContain(':disabled="busy !== null"');
    expect(fallback).toContain(':aria-disabled="busy !== null"');
    expect(fallback).toContain('@click="chooseImage"');
  });

  it("uses the Figma profile form hierarchy without changing the writable profile fields", () => {
    const nicknameIndex = source.indexOf(">昵称</text>");
    const phoneIndex = source.indexOf(">手机号</text>");
    const regionIndex = source.indexOf(">地区</text>");
    const bioIndex = source.indexOf(">个人简介</text>");

    expect(nicknameIndex).toBeGreaterThan(-1);
    expect(phoneIndex).toBeGreaterThan(nicknameIndex);
    expect(regionIndex).toBeGreaterThan(phoneIndex);
    expect(bioIndex).toBeGreaterThan(regionIndex);
    expect(source).toContain("基础资料");
    expect(source).toContain('class="profile-edit-page"');
    expect(source).toContain('font-family: "Noto Sans SC"');
    expect(source).toContain("h-avatar-xl w-avatar-xl");
    expect(source).toContain("profile-avatar-camera-bg.svg");
    expect(source).toContain("profile-camera.svg");
    expect(source).toContain('mode="region"');
    expect(source).toContain("profile-location.svg");
    expect(source).not.toContain("完善手机号");
    expect(source).not.toContain("验证并绑定");
    expect(source).toContain("<wd-popup");
    expect(source).toContain('position="bottom"');
    expect(source).toContain('v-if="profile.phoneMasked === null"');
    expect(source).toContain('@click="openPhoneSheet"');
    expect(source).toContain('id="phone-error"');
    expect(source).toContain('id="code-error"');
    expect(source).toContain("请输入手机号");
    expect(source).toContain("请输入正确的手机号");
    expect(source).toContain("请输入验证码");
    expect(source).toContain("请输入 6 位验证码");
    expect(source).toContain("MINIAPP_ACCOUNT_ERROR_CODE.PHONE_CONFLICT");
    expect(source).toContain('error.code === "NETWORK_ERROR"');
    expect(source).toMatch(
      /function startCountdown\(\)[\s\S]*clearCountdown\(\);[\s\S]*setInterval/,
    );
    expect(source).toContain('return codeSent.value ? "重新获取" : "获取验证码"');
  });

  it("keeps field and action availability semantics aligned", () => {
    expect(source).toContain(':disabled="busy !== null"');
    expect(source).toContain(':aria-disabled="busy !== null"');
    expect(source).toContain(':disabled="saveDisabled"');
    expect(source).toContain(':aria-disabled="saveDisabled"');
    expect(source).toContain(":aria-busy=\"busy === 'save'\"");
    expect(source).toContain('saveDisabled.value || busy.value === "save"');
  });
});
