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
    expect(source).toContain('loginPending ? "登录中…" : "微信一键登录"');
  });
});
