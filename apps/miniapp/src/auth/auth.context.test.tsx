import { WechatSession } from "@petcare/shared-types";
import Taro from "@tarojs/taro";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as authApi from "./auth.api";
import { AuthProvider, useAuth } from "./auth.context";
import * as authSession from "./auth.session";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: { login: jest.fn() },
}));

jest.mock("./auth.api", () => ({
  loginWithWechat: jest.fn(),
  bindWechatPhone: jest.fn(),
  logoutWechatSession: jest.fn(),
}));

jest.mock("./auth.session", () => ({
  restoreSession: jest.fn(),
  saveStoredSession: jest.fn(),
  clearStoredSession: jest.fn(),
}));

const session: WechatSession = {
  accessToken: "access",
  refreshToken: "refresh",
  user: {
    id: "user-1",
    phone: "13800138000",
    nickname: "宠友1878",
    avatar: null,
    userType: "pet_owner",
  },
};

function AuthProbe() {
  const auth = useAuth();

  return (
    <>
      <span>{auth.status}</span>
      <span>{auth.user?.nickname ?? "no-user"}</span>
      <button type="button" onClick={() => void auth.login()}>
        login
      </button>
      <button type="button" onClick={() => void auth.bindPhone("bind-token", "phone-code")}>
        bind
      </button>
      <button type="button" onClick={() => void auth.logout().catch(() => undefined)}>
        logout
      </button>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Taro.login).mockResolvedValue({
      code: "login-code",
      errMsg: "login:ok",
    });
    jest.mocked(authSession.restoreSession).mockResolvedValue(null);
    jest.mocked(authSession.saveStoredSession).mockResolvedValue(undefined);
    jest.mocked(authSession.clearStoredSession).mockResolvedValue(undefined);
  });

  it("becomes guest when no session exists", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("guest")).toBeInTheDocument();
    expect(screen.getByText("no-user")).toBeInTheDocument();
  });

  it("restores an authenticated session", async () => {
    jest.mocked(authSession.restoreSession).mockResolvedValue(session);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(screen.getByText("宠友1878")).toBeInTheDocument();
  });

  it("saves a directly authenticated WeChat login", async () => {
    jest.mocked(authApi.loginWithWechat).mockResolvedValue({
      status: "authenticated",
      ...session,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await screen.findByText("guest");
    fireEvent.click(screen.getByText("login"));

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(authApi.loginWithWechat).toHaveBeenCalledWith("login-code");
    expect(authSession.saveStoredSession).toHaveBeenCalledWith(session);
  });

  it("returns a binding challenge without persisting it", async () => {
    jest.mocked(authApi.loginWithWechat).mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });
    let result: unknown;

    function LoginProbe() {
      const auth = useAuth();

      return (
        <button
          type="button"
          onClick={async () => {
            result = await auth.login();
          }}
        >
          challenge
        </button>
      );
    }

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("challenge"));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result).toEqual({
      status: "phone_required",
      bindToken: "bind-token",
    });
    expect(authSession.saveStoredSession).not.toHaveBeenCalled();
  });

  it("binds a phone and enters the authenticated state", async () => {
    jest.mocked(authApi.bindWechatPhone).mockResolvedValue({
      status: "authenticated",
      ...session,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await screen.findByText("guest");
    fireEvent.click(screen.getByText("bind"));

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(authSession.saveStoredSession).toHaveBeenCalledWith(session);
  });

  it.each(["success", "failure"])("clears local state after logout API %s", async (outcome) => {
    jest.mocked(authSession.restoreSession).mockResolvedValue(session);

    if (outcome === "failure") {
      jest.mocked(authApi.logoutWechatSession).mockRejectedValue(new Error("network"));
    } else {
      jest.mocked(authApi.logoutWechatSession).mockResolvedValue(undefined);
    }

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await screen.findByText("authenticated");
    fireEvent.click(screen.getByText("logout"));

    expect(await screen.findByText("guest")).toBeInTheDocument();
    expect(authSession.clearStoredSession).toHaveBeenCalled();
  });

  it("does not update state after an asynchronous restore is unmounted", async () => {
    let resolveRestore: ((value: WechatSession | null) => void) | undefined;
    const restore = new Promise<WechatSession | null>((resolve) => {
      resolveRestore = resolve;
    });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    jest.mocked(authSession.restoreSession).mockReturnValue(restore);
    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    view.unmount();
    resolveRestore?.(session);
    await act(async () => {
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
