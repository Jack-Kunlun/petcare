import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runLogoutFlow } from "./logout";

const profileSource = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");
const settingsSource = readFileSync(
  resolve(import.meta.dirname, "../../pages-account/account/settings.vue"),
  "utf8",
);

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
  it("keeps the personal center within account, pet, and support capabilities", () => {
    expect(profileSource).toContain("我的宠物");
    expect(profileSource).toContain("帮助与协议");
    expect(profileSource).not.toContain("pages-care");
    expect(profileSource).not.toContain("优惠券");
    expect(profileSource).not.toContain("余额收入");
    expect(profileSource).not.toContain("我的评价");
  });

  it("gives anonymous profile and pet content distinct visual states", () => {
    expect(profileSource.match(/status="unauthenticated"/g)).toHaveLength(1);
    expect(profileSource).toContain("登录后可查看和维护你的个人资料。");
    expect(profileSource).toContain("建立宠物档案");
    expect(profileSource).toContain("登录后可添加和管理宠物资料");
    expect(profileSource).toContain("/static/main/profile-dog.png");
    expect(profileSource).not.toContain("登录后管理宠物档案");
  });

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

  it("moves logout and cancellation out of My into settings", () => {
    expect(profileSource).toContain('url="/pages-account/account/settings"');
    expect(profileSource).toContain("/static/main/settings.svg");
    expect(profileSource).not.toContain("logoutCurrentDevice");
    expect(profileSource).not.toContain("openCancellation");
    expect(profileSource).not.toContain("退出登录");
    expect(profileSource).not.toContain("注销账号");
  });

  it("keeps logout and cancellation as explicit settings actions", () => {
    expect(settingsSource).toContain("function openCancellation(): void");
    expect(settingsSource).toContain('url: "/pages-account/account/cancel"');
    expect(settingsSource).toContain('@click="logoutCurrentDevice"');
    expect(settingsSource).toContain('@click="openCancellation"');
    expect(settingsSource).toContain('logoutPending ? "退出中…" : "退出登录"');
    expect(settingsSource).toContain("注销账号");
    expect(settingsSource).toContain('variant="danger"');
  });

  it("keeps anonymous settings recoverable without destructive controls", () => {
    expect(settingsSource).toContain('v-else-if="!profile"');
    expect(settingsSource).toContain('status="unauthenticated"');
    expect(settingsSource).toContain('primary-label="微信登录"');
    expect(settingsSource).toContain("<template v-else>");
  });
});
