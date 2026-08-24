import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../api/auth";
import { useAuth } from "./auth.context";
import { AuthProvider } from "./AuthProvider";
import { onSessionExpired } from "./session-expired";

const authEvents = vi.hoisted(() => ({
  sessionExpiredListener: undefined as ((message: string) => void) | undefined,
}));
const globalErrors = vi.hoisted(() => ({
  showApiError: vi.fn(),
  showGlobalError: vi.fn(),
}));

vi.mock("../api/auth", () => ({
  clearAccessToken: vi.fn(),
  getCaptcha: vi.fn(),
  getCurrentUser: vi.fn(),
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  sendSmsCode: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock("./session-expired", () => ({
  onSessionExpired: vi.fn((listener: (message: string) => void) => {
    authEvents.sessionExpiredListener = listener;

    return () => {
      authEvents.sessionExpiredListener = undefined;
    };
  }),
}));

vi.mock("../lib/global-error", () => globalErrors);

const adminUser = {
  id: "user-1",
  username: "admin",
  phone: "13800138000",
  nickname: "系统管理员",
  avatar: null,
  roles: ["super_admin"],
  permissions: ["system.view", "system.publish"],
};

function StateProbe() {
  const auth = useAuth();

  return <div>{auth.status === "authenticated" ? auth.user?.nickname : auth.status}</div>;
}

function LogoutProbe() {
  const auth = useAuth();

  return (
    <>
      <span>{auth.status}</span>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </>
  );
}

function CaptchaActionsProbe() {
  const auth = useAuth();
  const [captchaId, setCaptchaId] = useState("none");

  return (
    <>
      <span>{captchaId}</span>
      <button
        type="button"
        onClick={() => {
          void auth.getCaptcha().then((challenge) => setCaptchaId(challenge.captchaId));
        }}
      >
        load captcha
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.sendSmsCode("13800138000", "0123456789abcdef", "2345");
        }}
      >
        send sms
      </button>
    </>
  );
}

function AccountActionsProbe() {
  const auth = useAuth();

  return (
    <>
      <output data-testid="auth-status">{auth.status}</output>
      <output data-testid="user-summary">
        {auth.user
          ? [
              auth.user.id,
              auth.user.username,
              auth.user.roles.join(","),
              auth.user.permissions.join(","),
              auth.user.nickname,
              auth.user.avatar,
            ].join("|")
          : "none"}
      </output>
      <button
        type="button"
        onClick={() =>
          auth.updateUserSummary({ nickname: "新昵称", avatar: "https://cdn/avatar.png" })
        }
      >
        update summary
      </button>
      <button type="button" onClick={() => auth.invalidateLocalSession()}>
        invalidate session
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores an authenticated session on startup", async () => {
    vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser);

    render(
      <AuthProvider>
        <StateProbe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("系统管理员")).toBeInTheDocument();
    expect(authApi.setAccessToken).toHaveBeenCalledWith("access");
  });

  it("becomes anonymous when refresh fails", async () => {
    vi.mocked(authApi.refreshSession).mockRejectedValue(new Error("unauthorized"));

    render(
      <AuthProvider>
        <StateProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(authApi.clearAccessToken).toHaveBeenCalled();
  });

  it("invalidates an authenticated session and emits a priority message", async () => {
    vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser);
    render(
      <AuthProvider>
        <StateProbe />
      </AuthProvider>,
    );
    await screen.findByText("系统管理员");
    expect(onSessionExpired).toHaveBeenCalledOnce();

    act(() => authEvents.sessionExpiredListener?.("登录状态已失效"));

    expect(screen.getByText("anonymous")).toBeInTheDocument();
    expect(globalErrors.showGlobalError).toHaveBeenCalledWith("登录状态已失效", "session");
  });

  it("delegates graphical captcha loading and protected SMS sending", async () => {
    vi.mocked(authApi.refreshSession).mockRejectedValue(new Error("unauthorized"));
    vi.mocked(authApi.getCaptcha).mockResolvedValue({
      captchaId: "0123456789abcdef",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
      expiresIn: 300,
    });
    vi.mocked(authApi.sendSmsCode).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <CaptchaActionsProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "load captcha" }));
    expect(await screen.findByText("0123456789abcdef")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "send sms" }));

    expect(authApi.getCaptcha).toHaveBeenCalledOnce();
    expect(authApi.sendSmsCode).toHaveBeenCalledWith("13800138000", "0123456789abcdef", "2345");
  });

  it("reports logout failure and still clears the local session", async () => {
    const failure = { response: { data: { message: "退出登录失败" } } };

    vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser);
    vi.mocked(authApi.logout).mockRejectedValue(failure);
    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );
    await screen.findByText("authenticated");

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
    expect(authApi.clearAccessToken).toHaveBeenCalled();
    expect(screen.getByText("anonymous")).toBeInTheDocument();
    expect(globalErrors.showGlobalError).not.toHaveBeenCalled();
  });

  it("updates only the user summary and invalidates the local session without logout", async () => {
    vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(adminUser);

    render(
      <AuthProvider>
        <AccountActionsProbe />
      </AuthProvider>,
    );

    await screen.findByText("user-1|admin|super_admin|system.view,system.publish|系统管理员|");
    fireEvent.click(screen.getByRole("button", { name: "update summary" }));

    expect(screen.getByTestId("user-summary")).toHaveTextContent(
      "user-1|admin|super_admin|system.view,system.publish|新昵称|https://cdn/avatar.png",
    );

    fireEvent.click(screen.getByRole("button", { name: "invalidate session" }));

    expect(screen.getByTestId("auth-status")).toHaveTextContent("anonymous");
    expect(screen.getByTestId("user-summary")).toHaveTextContent("none");
    expect(authApi.clearAccessToken).toHaveBeenCalledOnce();
    expect(authApi.logout).not.toHaveBeenCalled();
  });
});
