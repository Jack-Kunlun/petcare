import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runLogoutFlow } from "./logout";

const source = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("profile logout control", () => {
  it("runs only one logout and home relaunch while pending", async () => {
    const pending = { value: false };
    const operation = deferred<void>();
    const logout = vi.fn(() => operation.promise);
    const reLaunch = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn().mockResolvedValue(undefined);

    const first = runLogoutFlow(pending, { logout, reLaunch, showToast });
    const second = runLogoutFlow(pending, { logout, reLaunch, showToast });

    expect(pending.value).toBe(true);
    expect(logout).toHaveBeenCalledTimes(1);
    operation.resolve(undefined);
    await Promise.all([first, second]);

    expect(reLaunch).toHaveBeenCalledWith({ url: "/pages/index/index" });
    expect(reLaunch).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
    expect(pending.value).toBe(false);
  });

  it("reports a navigation failure without repeating logout", async () => {
    const pending = { value: false };
    const logout = vi.fn().mockResolvedValue(undefined);
    const reLaunch = vi.fn().mockRejectedValue(new Error("navigation failed"));
    const showToast = vi.fn().mockResolvedValue(undefined);

    await runLogoutFlow(pending, { logout, reLaunch, showToast });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(reLaunch).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({ title: "已退出但返回首页失败", icon: "none" });
    expect(pending.value).toBe(false);
  });

  it("reports a local logout failure without navigating", async () => {
    const pending = { value: false };
    const logout = vi.fn().mockRejectedValue(new Error("storage unavailable"));
    const reLaunch = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn().mockResolvedValue(undefined);

    await runLogoutFlow(pending, { logout, reLaunch, showToast });

    expect(reLaunch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({ title: "退出登录失败，请重试", icon: "none" });
    expect(pending.value).toBe(false);
  });

  it("keeps only the native-button wiring assertion", () => {
    expect(source).toMatch(/<button\b/);
    expect(source).toContain('v-if="profile"');
    expect(source).toContain(':disabled="logoutPending"');
    expect(source).toContain(':aria-disabled="logoutPending"');
    expect(source).toContain('@click="logoutCurrentDevice"');
    expect(source).toContain('logoutPending ? "退出中…" : "退出登录"');
  });
});
