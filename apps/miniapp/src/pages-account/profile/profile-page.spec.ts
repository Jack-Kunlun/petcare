import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "edit.vue"), "utf8");
const fieldSource = readFileSync(resolve(import.meta.dirname, "ProfileField.vue"), "utf8");

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

  it("keeps profile fields continuous and moves first-time phone binding into a bottom sheet", () => {
    const nicknameIndex = source.indexOf('label="昵称"');
    const phoneIndex = source.indexOf('label="手机号"');
    const regionIndex = source.indexOf('label="所在地区"');
    const bioIndex = source.indexOf('label="个人简介"');

    expect(nicknameIndex).toBeGreaterThan(-1);
    expect(phoneIndex).toBeGreaterThan(nicknameIndex);
    expect(regionIndex).toBeGreaterThan(phoneIndex);
    expect(bioIndex).toBeGreaterThan(regionIndex);
    expect(source).not.toContain("完善手机号");
    expect(source).not.toContain("验证并绑定");
    expect(source).toContain("<wd-popup");
    expect(source).toContain('position="bottom"');
    expect(source).toContain(':clickable="profile.phoneMasked === null"');
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
    for (const prop of [
      "label",
      "value",
      "placeholder",
      "clickable",
      "readonly",
      "disabled",
      "required",
      "helper",
      "error",
      "rightIcon",
    ]) {
      expect(fieldSource).toContain(`${prop}`);
    }

    expect(fieldSource).toContain(':disabled="!interactive"');
    expect(fieldSource).toContain(':aria-disabled="!interactive"');
    expect(source).toContain(':disabled="saveDisabled"');
    expect(source).toContain(':aria-disabled="saveDisabled"');
  });
});
