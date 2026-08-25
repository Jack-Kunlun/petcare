import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("auth page login control", () => {
  it("uses a natively disabled button while login is pending", () => {
    expect(source).toMatch(/<button\b/);
    expect(source).not.toContain("<wd-button");
    expect(source).toContain(':disabled="loginPending"');
    expect(source).toContain(':aria-disabled="loginPending"');
    expect(source).toContain('"登录中…"');
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
