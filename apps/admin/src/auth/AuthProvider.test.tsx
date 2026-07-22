import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "./auth.api";
import { useAuth } from "./auth.context";
import { AuthProvider } from "./AuthProvider";

vi.mock("./auth.api", () => ({
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

const adminUser = {
  id: "user-1",
  username: "admin",
  phone: "17679141878",
  nickname: "系统管理员",
  roles: ["super_admin"],
};

function StateProbe() {
  const auth = useAuth();

  return <div>{auth.status === "authenticated" ? auth.user?.nickname : auth.status}</div>;
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
          void auth.sendSmsCode("17679141878", "0123456789abcdef", "2345");
        }}
      >
        send sms
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
    expect(authApi.sendSmsCode).toHaveBeenCalledWith("17679141878", "0123456789abcdef", "2345");
  });
});
