export interface PendingRef {
  value: boolean;
}

interface LogoutFlowDependencies {
  logout: () => Promise<void>;
  reLaunch: (options: { url: string }) => Promise<unknown>;
  showToast: (options: { title: string; icon: "none" }) => Promise<unknown>;
}

export async function runLogoutFlow(
  pending: PendingRef,
  { logout, reLaunch, showToast }: LogoutFlowDependencies,
): Promise<void> {
  if (pending.value) {
    return;
  }

  pending.value = true;

  try {
    try {
      await logout();
    } catch {
      await showToast({ title: "退出登录失败，请重试", icon: "none" });

      return;
    }

    try {
      await reLaunch({ url: "/pages/index/index" });
    } catch {
      await showToast({ title: "已退出但返回首页失败", icon: "none" });
    }
  } finally {
    pending.value = false;
  }
}
