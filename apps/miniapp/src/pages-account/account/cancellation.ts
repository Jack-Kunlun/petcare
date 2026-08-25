import { MiniappApiError } from "../../api/request";

export function getCancellationRequirement(phoneMasked: string | null) {
  return phoneMasked
    ? { requiresCode: true, phoneLabel: phoneMasked }
    : { requiresCode: false, phoneLabel: "未绑定手机号" };
}

export interface CancellationFlowState {
  sending: boolean;
  cancelling: boolean;
  errorMessage: string;
}

interface ToastOptions {
  title: string;
  icon: "none" | "success";
}

interface CancellationCodeDependencies {
  sendCancellationCode: () => Promise<void>;
  startCountdown: () => void;
  showToast: (options: ToastOptions) => Promise<unknown>;
}

interface CancellationDependencies {
  showModal: (options: {
    title: string;
    content: string;
    confirmText: string;
    cancelText: string;
  }) => Promise<{ confirm?: boolean }>;
  cancelAccount: (code?: string) => Promise<void>;
  completeCancellation: () => void;
  showToast: (options: ToastOptions) => Promise<unknown>;
  reLaunch: (options: { url: string }) => Promise<unknown>;
}

function cancellationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof MiniappApiError) {
    if (error.code === "ACTIVE_ORDER_EXISTS") {
      return "存在进行中的订单，完成或取消后才能注销";
    }

    if (
      error.code === "CANCELLATION_CODE_REQUIRED" ||
      error.code === "CANCELLATION_CODE_NOT_REQUIRED"
    ) {
      return "账户资料已变化，请刷新资料后重新进入注销页面";
    }

    return error.message || fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export async function runCancellationCodeFlow(
  state: CancellationFlowState,
  requiresCode: boolean,
  dependencies: CancellationCodeDependencies,
): Promise<void> {
  if (!requiresCode || state.sending || state.cancelling) {
    return;
  }

  state.sending = true;
  state.errorMessage = "";

  try {
    await dependencies.sendCancellationCode();
    dependencies.startCountdown();
    await dependencies.showToast({ title: "验证码已发送", icon: "none" }).catch(() => undefined);
  } catch (error) {
    state.errorMessage = cancellationErrorMessage(error, "验证码发送失败，请重试");
  } finally {
    state.sending = false;
  }
}

export async function runCancellationFlow(
  state: CancellationFlowState,
  input: { requiresCode: boolean; code: string },
  dependencies: CancellationDependencies,
): Promise<void> {
  if (state.sending || state.cancelling) {
    return;
  }

  const code = input.code.trim();

  if (input.requiresCode && !/^\d{6}$/u.test(code)) {
    state.errorMessage = "请输入 6 位短信验证码";

    return;
  }

  state.cancelling = true;
  state.errorMessage = "";

  try {
    let confirmed = false;

    try {
      confirmed =
        (
          await dependencies.showModal({
            title: "确认注销账户？",
            content: "注销后账户无法恢复，所有设备会话将失效，历史记录仍按规则保留。",
            confirmText: "确认注销",
            cancelText: "暂不注销",
          })
        ).confirm === true;
    } catch {
      state.errorMessage = "无法确认注销，请重试";

      return;
    }

    if (!confirmed) {
      return;
    }

    try {
      await dependencies.cancelAccount(input.requiresCode ? code : undefined);
    } catch (error) {
      state.errorMessage = cancellationErrorMessage(error, "注销失败，请重试");

      return;
    }

    try {
      dependencies.completeCancellation();
    } catch {
      state.errorMessage = "账户已注销，本机登录状态清理不完整，请关闭并重新打开小程序";
      await dependencies
        .showToast({ title: "账户已注销，请重新打开小程序", icon: "none" })
        .catch(() => undefined);

      try {
        await dependencies.reLaunch({ url: "/pages/index/index" });
      } catch {
        // The recovery message already tells the user how to leave stale local state behind.
      }

      return;
    }

    await dependencies.showToast({ title: "账户已注销", icon: "success" }).catch(() => undefined);

    try {
      await dependencies.reLaunch({ url: "/pages/index/index" });
    } catch {
      state.errorMessage = "账户已注销，但返回首页失败，请手动返回";
      await dependencies
        .showToast({ title: "账户已注销，请手动返回首页", icon: "none" })
        .catch(() => undefined);
    }
  } finally {
    state.cancelling = false;
  }
}
