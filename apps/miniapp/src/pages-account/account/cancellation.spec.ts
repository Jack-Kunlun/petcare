import { describe, expect, it, vi } from "vitest";
import { MiniappApiError } from "../../api/request";
import {
  getCancellationRequirement,
  runCancellationCodeFlow,
  runCancellationFlow,
} from "./cancellation";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createState() {
  return { sending: false, cancelling: false, errorMessage: "" };
}

function dependencies() {
  return {
    showModal: vi.fn().mockResolvedValue({ confirm: true }),
    cancelAccount: vi.fn().mockResolvedValue(undefined),
    completeCancellation: vi.fn(),
    showToast: vi.fn().mockResolvedValue(undefined),
    reLaunch: vi.fn().mockResolvedValue(undefined),
  };
}

describe("getCancellationRequirement", () => {
  it("requires SMS only for a bound phone", () => {
    expect(getCancellationRequirement("138****8000")).toEqual({
      requiresCode: true,
      phoneLabel: "138****8000",
    });
    expect(getCancellationRequirement(null)).toEqual({
      requiresCode: false,
      phoneLabel: "未绑定手机号",
    });
  });
});

describe("cancellation code flow", () => {
  it("sends once and starts the countdown only after success", async () => {
    const state = createState();
    const request = deferred<void>();
    const sendCancellationCode = vi.fn(() => request.promise);
    const startCountdown = vi.fn();
    const showToast = vi.fn().mockResolvedValue(undefined);

    const first = runCancellationCodeFlow(state, true, {
      sendCancellationCode,
      startCountdown,
      showToast,
    });
    const second = runCancellationCodeFlow(state, true, {
      sendCancellationCode,
      startCountdown,
      showToast,
    });

    expect(state.sending).toBe(true);
    expect(sendCancellationCode).toHaveBeenCalledTimes(1);
    expect(startCountdown).not.toHaveBeenCalled();

    request.resolve(undefined);
    await Promise.all([first, second]);

    expect(startCountdown).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({ title: "验证码已发送", icon: "none" });
    expect(state.sending).toBe(false);
  });

  it("does not send for an unbound account or start a countdown after failure", async () => {
    const state = createState();
    const sendCancellationCode = vi
      .fn()
      .mockRejectedValue(new MiniappApiError(409, "ACTIVE_ORDER_EXISTS", "存在进行中的订单"));
    const startCountdown = vi.fn();
    const showToast = vi.fn().mockResolvedValue(undefined);

    await runCancellationCodeFlow(state, false, {
      sendCancellationCode,
      startCountdown,
      showToast,
    });
    expect(sendCancellationCode).not.toHaveBeenCalled();

    await runCancellationCodeFlow(state, true, {
      sendCancellationCode,
      startCountdown,
      showToast,
    });

    expect(startCountdown).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("存在进行中的订单，完成或取消后才能注销");
  });
});

describe("account cancellation flow", () => {
  it("does not request cancellation when confirmation is declined", async () => {
    const state = createState();
    const deps = dependencies();

    deps.showModal.mockResolvedValue({ confirm: false });

    await runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

    expect(deps.showModal).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: "确认注销" }),
    );
    expect(deps.cancelAccount).not.toHaveBeenCalled();
    expect(deps.completeCancellation).not.toHaveBeenCalled();
  });

  it("submits one bound-account cancellation in the required completion order", async () => {
    const state = createState();
    const request = deferred<void>();
    const order: string[] = [];
    const deps = dependencies();

    deps.cancelAccount.mockImplementation(async (code) => {
      order.push(`server:${code}`);
      await request.promise;
    });
    deps.completeCancellation.mockImplementation(() => order.push("local"));
    deps.showToast.mockImplementation(async () => {
      order.push("toast");
    });
    deps.reLaunch.mockImplementation(async () => {
      order.push("home");
    });

    const first = runCancellationFlow(state, { requiresCode: true, code: "123456" }, deps);
    const second = runCancellationFlow(state, { requiresCode: true, code: "123456" }, deps);

    await vi.waitFor(() => expect(deps.cancelAccount).toHaveBeenCalledTimes(1));
    request.resolve(undefined);
    await Promise.all([first, second]);

    expect(order).toEqual(["server:123456", "local", "toast", "home"]);
    expect(deps.showToast).toHaveBeenCalledWith({ title: "账户已注销", icon: "success" });
    expect(deps.reLaunch).toHaveBeenCalledWith({ url: "/pages/index/index" });
    expect(state.cancelling).toBe(false);
  });

  it("preserves the session and explains server cancellation failures", async () => {
    const state = createState();
    const deps = dependencies();

    deps.cancelAccount.mockRejectedValue(
      new MiniappApiError(409, "ACTIVE_ORDER_EXISTS", "存在进行中的订单"),
    );

    await runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

    expect(deps.completeCancellation).not.toHaveBeenCalled();
    expect(deps.showToast).not.toHaveBeenCalled();
    expect(deps.reLaunch).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("存在进行中的订单，完成或取消后才能注销");
  });

  it.each(["CANCELLATION_CODE_REQUIRED", "CANCELLATION_CODE_NOT_REQUIRED"])(
    "does not guess success when the server reports %s",
    async (code) => {
      const state = createState();
      const deps = dependencies();

      deps.cancelAccount.mockRejectedValue(new MiniappApiError(400, code, "资料已变化"));

      await runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

      expect(deps.completeCancellation).not.toHaveBeenCalled();
      expect(state.errorMessage).toBe("账户资料已变化，请刷新资料后重新进入注销页面");
    },
  );

  it("reports local cleanup and navigation failures as already cancelled", async () => {
    const cleanupState = createState();
    const cleanupDeps = dependencies();

    cleanupDeps.completeCancellation.mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    await runCancellationFlow(cleanupState, { requiresCode: false, code: "" }, cleanupDeps);

    expect(cleanupDeps.cancelAccount).toHaveBeenCalledTimes(1);
    expect(cleanupState.errorMessage).toContain("账户已注销");
    expect(cleanupState.errorMessage).not.toContain("重试注销");
    expect(cleanupDeps.reLaunch).toHaveBeenCalledWith({ url: "/pages/index/index" });

    const navigationState = createState();
    const navigationDeps = dependencies();

    navigationDeps.reLaunch.mockRejectedValue(new Error("navigation failed"));

    await runCancellationFlow(navigationState, { requiresCode: false, code: "" }, navigationDeps);

    expect(navigationState.errorMessage).toBe("账户已注销，但返回首页失败，请手动返回");
    expect(navigationDeps.showToast).toHaveBeenLastCalledWith({
      title: "账户已注销，请手动返回首页",
      icon: "none",
    });
  });
});
