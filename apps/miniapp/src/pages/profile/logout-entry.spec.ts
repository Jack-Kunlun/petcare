import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

describe("profile logout control", () => {
  it("uses one natively disabled logout button while pending", () => {
    expect(source).toMatch(/<button\b/);
    expect(source).toContain(':disabled="logoutPending"');
    expect(source).toContain(':aria-disabled="logoutPending"');
    expect(source).toContain('@click="logoutCurrentDevice"');
    expect(source).toContain('logoutPending ? "退出中…" : "退出登录"');
  });
});
