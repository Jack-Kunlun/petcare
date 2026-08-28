import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("auth page login control", () => {
  it("describes only current personal capabilities", () => {
    expect(source).toContain("宠物档案");
    expect(source).toContain("萌宠课堂");
    expect(source).toContain("受控社区");
    expect(source).not.toContain("实名认证");
    expect(source).not.toContain("平台保障");
    expect(source).not.toContain("照护者");
  });

  it("uses the shared native button while login is pending", () => {
    expect(source).toContain("<PcButton");
    expect(source).toContain('size="control"');
    expect(source).toContain('<view class="w-agreement">');
    expect(source).not.toContain("<wd-button");
    expect(source).toContain(':disabled="loginPending"');
    expect(source).toContain(':loading="loginPending"');
    expect(source).toContain('"登录中…"');
  });

  it("restores the approved hero and keeps legal links compact", () => {
    expect(source).toContain(':src="MINIAPP_TRUSTED_CARE_HERO"');
    expect(source).toContain("mt-actions flex flex-col items-center gap-copy");
    expect(source).toContain("flex items-center py-caption text-brand-active");
    expect(source).not.toContain("h-control flex items-center text-brand-active");
  });

  it("retries only navigation after authentication has already succeeded", () => {
    expect(source).toContain("const loginComplete = ref(false)");
    expect(source).toMatch(
      /if \(!loginComplete\.value\)[\s\S]*await loginInteractively\(\)[\s\S]*loginComplete\.value = true/,
    );
    expect(source).toContain("登录成功，但页面跳转失败，请再次点击进入首页");
    expect(source).toMatch(/loginComplete\s*\? "进入首页"\s*:\s*"微信一键登录"/);
  });
});
