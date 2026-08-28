import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "settings.vue"), "utf8");

describe("account settings page", () => {
  it("owns account security, logout, and cancellation entry points", () => {
    expect(source).toContain('title="设置"');
    expect(source).toContain("账号与安全");
    expect(source).toContain("runLogoutFlow");
    expect(source).toContain("logoutCurrentDevice");
    expect(source).toContain('url: "/pages-account/account/cancel"');
    expect(source).toContain('variant="danger"');
  });

  it("keeps anonymous settings recoverable without destructive actions", () => {
    expect(source).toContain('status="unauthenticated"');
    expect(source).toContain("微信登录");
    expect(source).toContain("if (!profile.value)");
    expect(source).not.toContain("cancelAccount");
  });
});
