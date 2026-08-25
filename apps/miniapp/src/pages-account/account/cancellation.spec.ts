import { MINIAPP_ACCOUNT_ERROR_CODE } from "@petcare/shared-types";
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

function createState() {
  return { sending: false, cancelling: false, errorMessage: "" };
}

function dependencies() {
  return {
    getCurrentUserId: vi.fn(() => "user-1" as string | null),
    isActive: vi.fn(() => true),
    showModal: vi.fn().mockResolvedValue({ confirm: true }),
    cancelAccount: vi.fn().mockResolvedValue(undefined),
    completeCancellation: vi.fn((_cancelledUserId: string) => true),
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
  it("requires a signed-in user before sending a code", async () => {
    const state = createState();
    const sendCancellationCode = vi.fn();

    await runCancellationCodeFlow(state, true, {
      getCurrentUserId: () => null,
      sendCancellationCode,
      startCountdown: vi.fn(),
      showToast: vi.fn(),
      isActive: () => true,
    });

    expect(sendCancellationCode).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("登录状态已变化，请重新进入注销页面");
  });

  it("sends once and starts the countdown only after success", async () => {
    const state = createState();
    const request = deferred<void>();
    const sendCancellationCode = vi.fn(() => request.promise);
    const startCountdown = vi.fn();
    const showToast = vi.fn().mockResolvedValue(undefined);

    const first = runCancellationCodeFlow(state, true, {
      getCurrentUserId: () => "user-1",
      sendCancellationCode,
      startCountdown,
      showToast,
      isActive: () => true,
    });
    const second = runCancellationCodeFlow(state, true, {
      getCurrentUserId: () => "user-1",
      sendCancellationCode,
      startCountdown,
      showToast,
      isActive: () => true,
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
      getCurrentUserId: () => "user-1",
      sendCancellationCode,
      startCountdown,
      showToast,
      isActive: () => true,
    });
    expect(sendCancellationCode).not.toHaveBeenCalled();

    await runCancellationCodeFlow(state, true, {
      getCurrentUserId: () => "user-1",
      sendCancellationCode,
      startCountdown,
      showToast,
      isActive: () => true,
    });

    expect(startCountdown).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("存在进行中的订单，完成或取消后才能注销");
  });

  it("ignores a pending code result after the page unloads", async () => {
    let active = true;
    const successState = createState();
    const successRequest = deferred<void>();
    const successCountdown = vi.fn();
    const successToast = vi.fn().mockResolvedValue(undefined);
    const success = runCancellationCodeFlow(successState, true, {
      getCurrentUserId: () => "user-1",
      sendCancellationCode: () => successRequest.promise,
      startCountdown: successCountdown,
      showToast: successToast,
      isActive: () => active,
    });

    active = false;
    successRequest.resolve(undefined);
    await success;

    expect(successCountdown).not.toHaveBeenCalled();
    expect(successToast).not.toHaveBeenCalled();
    expect(successState.errorMessage).toBe("");

    active = true;
    const failureState = createState();
    const failureRequest = deferred<void>();
    const failureCountdown = vi.fn();
    const failureToast = vi.fn().mockResolvedValue(undefined);
    const failure = runCancellationCodeFlow(failureState, true, {
      getCurrentUserId: () => "user-1",
      sendCancellationCode: () => failureRequest.promise,
      startCountdown: failureCountdown,
      showToast: failureToast,
      isActive: () => active,
    });

    active = false;
    failureRequest.reject(new MiniappApiError(0, "NETWORK_ERROR", "网络请求失败"));
    await failure;

    expect(failureCountdown).not.toHaveBeenCalled();
    expect(failureToast).not.toHaveBeenCalled();
    expect(failureState.errorMessage).toBe("");
  });

  it("ignores a pending code result after the signed-in user changes", async () => {
    const state = createState();
    const request = deferred<void>();
    const startCountdown = vi.fn();
    const showToast = vi.fn().mockResolvedValue(undefined);
    let currentUserId = "user-1";
    const pending = runCancellationCodeFlow(state, true, {
      getCurrentUserId: () => currentUserId,
      sendCancellationCode: () => request.promise,
      startCountdown,
      showToast,
      isActive: () => true,
    });

    currentUserId = "user-2";
    request.resolve(undefined);
    await pending;

    expect(startCountdown).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("");
  });

  it("does not expose a code-request failure to a replacement user", async () => {
    const state = createState();
    const request = deferred<void>();
    let currentUserId = "user-1";
    const pending = runCancellationCodeFlow(state, true, {
      getCurrentUserId: () => currentUserId,
      sendCancellationCode: () => request.promise,
      startCountdown: vi.fn(),
      showToast: vi.fn().mockResolvedValue(undefined),
      isActive: () => true,
    });

    currentUserId = "user-2";
    request.reject(new MiniappApiError(409, MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS, ""));
    await pending;

    expect(state.errorMessage).toBe("");
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

  it("requires one stable signed-in user before sending the cancellation request", async () => {
    const anonymousState = createState();
    const anonymousDeps = dependencies();

    anonymousDeps.getCurrentUserId.mockReturnValue(null);

    await runCancellationFlow(anonymousState, { requiresCode: false, code: "" }, anonymousDeps);

    expect(anonymousDeps.showModal).not.toHaveBeenCalled();
    expect(anonymousDeps.cancelAccount).not.toHaveBeenCalled();
    expect(anonymousState.errorMessage).toBe("登录状态已变化，请重新进入注销页面");

    const switchedState = createState();
    const switchedDeps = dependencies();
    let currentUserId = "user-1";

    switchedDeps.getCurrentUserId.mockImplementation(() => currentUserId);
    switchedDeps.showModal.mockImplementation(async () => {
      currentUserId = "user-2";

      return { confirm: true };
    });

    await runCancellationFlow(switchedState, { requiresCode: false, code: "" }, switchedDeps);

    expect(switchedDeps.getCurrentUserId).toHaveBeenCalledTimes(2);
    expect(switchedDeps.cancelAccount).not.toHaveBeenCalled();
    expect(switchedDeps.completeCancellation).not.toHaveBeenCalled();
    expect(switchedState.errorMessage).toBe("登录状态已变化，请重新进入注销页面");
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
    deps.completeCancellation.mockImplementation(() => {
      order.push("local");

      return true;
    });
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
    expect(deps.completeCancellation).toHaveBeenCalledWith("user-1");
    expect(deps.showToast).toHaveBeenCalledWith({ title: "账户已注销", icon: "success" });
    expect(deps.reLaunch).toHaveBeenCalledWith({ url: "/pages/index/index" });
    expect(state.cancelling).toBe(false);
  });

  it("does not clear or redirect a newer account after the old request succeeds", async () => {
    const state = createState();
    const request = deferred<void>();
    const deps = dependencies();
    let currentUserId = "user-1";

    deps.getCurrentUserId.mockImplementation(() => currentUserId);
    deps.cancelAccount.mockReturnValue(request.promise);
    deps.completeCancellation.mockImplementation((cancelledUserId) => {
      return cancelledUserId === currentUserId;
    });

    const pending = runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

    await vi.waitFor(() => expect(deps.cancelAccount).toHaveBeenCalledTimes(1));
    currentUserId = "user-2";
    request.resolve(undefined);
    await pending;

    expect(deps.completeCancellation).toHaveBeenCalledWith("user-1");
    expect(deps.reLaunch).not.toHaveBeenCalled();
    expect(deps.showToast).toHaveBeenCalledWith({
      title: "原账户已注销，当前登录未受影响",
      icon: "none",
    });
    expect(state.errorMessage).toBe("");
  });

  it("finishes an in-flight cancellation silently after the page unloads", async () => {
    let active = true;
    const successState = createState();
    const successRequest = deferred<void>();
    const successDeps = dependencies();

    successDeps.isActive.mockImplementation(() => active);
    successDeps.cancelAccount.mockReturnValue(successRequest.promise);

    const success = runCancellationFlow(
      successState,
      { requiresCode: false, code: "" },
      successDeps,
    );

    await vi.waitFor(() => expect(successDeps.cancelAccount).toHaveBeenCalledTimes(1));
    active = false;
    successRequest.resolve(undefined);
    await success;

    expect(successDeps.completeCancellation).toHaveBeenCalledWith("user-1");
    expect(successDeps.showToast).not.toHaveBeenCalled();
    expect(successDeps.reLaunch).not.toHaveBeenCalled();
    expect(successState.errorMessage).toBe("");

    active = true;
    const failureState = createState();
    const failureRequest = deferred<void>();
    const failureDeps = dependencies();

    failureDeps.isActive.mockImplementation(() => active);
    failureDeps.cancelAccount.mockReturnValue(failureRequest.promise);

    const failure = runCancellationFlow(
      failureState,
      { requiresCode: false, code: "" },
      failureDeps,
    );

    await vi.waitFor(() => expect(failureDeps.cancelAccount).toHaveBeenCalledTimes(1));
    active = false;
    failureRequest.reject(new MiniappApiError(409, "ACTIVE_ORDER_EXISTS", "存在进行中的订单"));
    await failure;

    expect(failureDeps.completeCancellation).not.toHaveBeenCalled();
    expect(failureDeps.showToast).not.toHaveBeenCalled();
    expect(failureDeps.reLaunch).not.toHaveBeenCalled();
    expect(failureState.errorMessage).toBe("");
  });

  it("does not expose a cancellation failure to a replacement user", async () => {
    const state = createState();
    const request = deferred<void>();
    const deps = dependencies();
    let currentUserId = "user-1";

    deps.getCurrentUserId.mockImplementation(() => currentUserId);
    deps.cancelAccount.mockReturnValue(request.promise);

    const pending = runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

    await vi.waitFor(() => expect(deps.cancelAccount).toHaveBeenCalledTimes(1));
    currentUserId = "user-2";
    request.reject(
      new MiniappApiError(409, MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS, "存在进行中的订单"),
    );
    await pending;

    expect(state.errorMessage).toBe("");
    expect(deps.completeCancellation).not.toHaveBeenCalled();
    expect(deps.showToast).not.toHaveBeenCalled();
    expect(deps.reLaunch).not.toHaveBeenCalled();
  });

  it("preserves the session and explains server cancellation failures", async () => {
    const state = createState();
    const deps = dependencies();

    deps.cancelAccount.mockRejectedValue(
      new MiniappApiError(409, MINIAPP_ACCOUNT_ERROR_CODE.ACTIVE_ORDER_EXISTS, "存在进行中的订单"),
    );

    await runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

    expect(deps.completeCancellation).not.toHaveBeenCalled();
    expect(deps.showToast).not.toHaveBeenCalled();
    expect(deps.reLaunch).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("存在进行中的订单，完成或取消后才能注销");
  });

  it.each([
    MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_REQUIRED,
    MINIAPP_ACCOUNT_ERROR_CODE.CANCELLATION_CODE_NOT_REQUIRED,
  ])("does not guess success when the server reports %s", async (code) => {
    const state = createState();
    const deps = dependencies();

    deps.cancelAccount.mockRejectedValue(new MiniappApiError(400, code, "资料已变化"));

    await runCancellationFlow(state, { requiresCode: false, code: "" }, deps);

    expect(deps.completeCancellation).not.toHaveBeenCalled();
    expect(state.errorMessage).toBe("账户资料已变化，请刷新资料后重新进入注销页面");
  });

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
