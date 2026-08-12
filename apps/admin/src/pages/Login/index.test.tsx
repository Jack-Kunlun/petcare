// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type InitialEntry, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import loginBackgroundUrl from "../../assets/brand/petcare-background-soft.svg";
import Login from ".";

const auth = vi.hoisted(() => ({
  getCaptcha: vi.fn(),
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  sendSmsCode: vi.fn(),
}));

const firstCaptcha = {
  captchaId: "0123456789abcdef",
  image: "data:image/svg+xml;base64,PHN2Zy8+",
  expiresIn: 300,
};

const secondCaptcha = {
  captchaId: "fedcba9876543210",
  image: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMSAxIi8+",
  expiresIn: 300,
};

vi.mock("../../auth/auth.context", () => ({
  useAuth: () => ({
    status: "anonymous",
    user: null,
    logout: vi.fn(),
    ...auth,
  }),
}));

function renderLogin(initialEntries: InitialEntry[] = ["/login"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<h1>仪表盘</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auth.loginWithPassword.mockResolvedValue(undefined);
    auth.loginWithSms.mockResolvedValue(undefined);
    auth.sendSmsCode.mockResolvedValue(undefined);
    auth.getCaptcha.mockResolvedValue(firstCaptcha);
  });

  it("submits an account or phone with a password", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.type(screen.getByLabelText("手机号或账号"), "admin");
    await user.type(screen.getByLabelText("密码"), "Correct-Horse-Battery-Staple!42");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(auth.loginWithPassword).toHaveBeenCalledWith("admin", "Correct-Horse-Battery-Staple!42");
    expect(await screen.findByRole("heading", { name: "仪表盘" })).toBeInTheDocument();
  });

  it("sends a code and logs in by phone", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await screen.findByRole("button", { name: "图形验证码，点击换一张" });
    await user.type(screen.getByLabelText("手机号"), "17679141878");
    await user.type(screen.getByLabelText("图形验证码"), "2345");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(auth.sendSmsCode).toHaveBeenCalledWith("17679141878", "0123456789abcdef", "2345");
    expect(screen.getByRole("button", { name: "60秒后重发" })).toBeDisabled();
    await waitFor(() => expect(auth.getCaptcha).toHaveBeenCalledTimes(2));

    await user.type(screen.getByLabelText("验证码"), "246810");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(auth.loginWithSms).toHaveBeenCalledWith("17679141878", "246810");
  });

  it("updates the selected tab and its mode indicator", async () => {
    const user = userEvent.setup();

    renderLogin();

    expect(screen.getByRole("tab", { name: "密码登录" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));

    expect(screen.getByRole("tab", { name: "验证码登录" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("login-mode-indicator")).toHaveClass("translate-x-full");
  });

  it("keeps the login panels stable and aligns sms controls", async () => {
    const user = userEvent.setup();

    renderLogin();

    expect(screen.getByRole("main")).toHaveClass("bg-linear-to-br");
    expect(screen.getByRole("main")).toHaveClass("overflow-x-hidden");
    const background = screen.getByTestId("login-background");

    expect(background).toHaveAttribute("src", loginBackgroundUrl);
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).toHaveClass("pointer-events-none", "absolute", "inset-0", "object-cover");
    expect(screen.getByTestId("login-card")).toHaveClass("min-h-[520px]", "md:h-[662px]");
    expect(screen.getByTestId("login-form")).toHaveClass("flex-1");
    expect(screen.getByTestId("login-welcome-label")).toHaveClass("text-text-secondary");
    expect(screen.getByTestId("login-form-panels")).toHaveClass("min-h-[284px]");
    expect(screen.queryByText("PetCare 管理后台")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("tab")[1]);

    expect(screen.getByTestId("sms-login-panel")).toHaveClass(
      "animate-[pc-page-enter_220ms_ease-out_both]",
    );
    expect(screen.getByTestId("captcha-code-input")).toHaveClass("h-12");
    expect(screen.getByTestId("send-code-button")).toHaveClass("h-12");
    expect(screen.getByTestId("captcha-row")).toHaveClass("h-12", "items-center");
    expect(screen.getByTestId("sms-code-row")).toHaveClass("h-12", "items-center");
    expect(screen.getByTestId("captcha-code-input")).not.toHaveClass("mt-2");
    expect(screen.getByTestId("sms-code-row").querySelector("input")).not.toHaveClass("mt-2");
  });

  it("validates a Chinese mobile number before sending a code", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await user.type(screen.getByLabelText("手机号"), "12345");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(auth.sendSmsCode).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("请输入正确的手机号");
  });

  it("loads a graphical captcha and refreshes it when clicked", async () => {
    auth.getCaptcha.mockResolvedValueOnce(firstCaptcha).mockResolvedValueOnce(secondCaptcha);
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    const refreshButton = await screen.findByRole("button", {
      name: "图形验证码，点击换一张",
    });

    expect(screen.getByRole("img", { name: "图形验证码" })).toHaveAttribute(
      "src",
      firstCaptcha.image,
    );

    await user.click(refreshButton);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "图形验证码" })).toHaveAttribute(
        "src",
        secondCaptcha.image,
      ),
    );
  });

  it("does not send an SMS without a graphical captcha answer", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await screen.findByRole("button", { name: "图形验证码，点击换一张" });
    await user.type(screen.getByLabelText("手机号"), "17679141878");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(auth.sendSmsCode).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("请输入 4 位图形验证码");
  });

  it("refreshes the graphical captcha after an SMS send failure", async () => {
    auth.getCaptcha.mockResolvedValueOnce(firstCaptcha).mockResolvedValueOnce(secondCaptcha);
    auth.sendSmsCode.mockRejectedValue(new Error("invalid captcha"));
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await screen.findByRole("button", { name: "图形验证码，点击换一张" });
    await user.type(screen.getByLabelText("手机号"), "17679141878");
    await user.type(screen.getByLabelText("图形验证码"), "2345");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("验证码发送失败，请稍后重试");
    expect(screen.getByLabelText("图形验证码")).toHaveValue("");
    await waitFor(() => expect(auth.getCaptcha).toHaveBeenCalledTimes(2));
  });

  it("offers a retry when graphical captcha loading fails", async () => {
    auth.getCaptcha
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue(firstCaptcha);
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    const retryButton = await screen.findByRole("button", { name: "重新加载图形验证码" });

    await user.click(retryButton);

    expect(
      await screen.findByRole("button", { name: "图形验证码，点击换一张" }),
    ).toBeInTheDocument();
    expect(auth.getCaptcha).toHaveBeenCalledTimes(2);
  });

  it("disables the send button while an SMS code is being sent", async () => {
    let resolveSendCode: (() => void) | undefined;

    auth.sendSmsCode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSendCode = resolve;
        }),
    );
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await screen.findByRole("button", { name: "图形验证码，点击换一张" });
    await user.type(screen.getByLabelText("手机号"), "17679141878");
    await user.type(screen.getByLabelText("图形验证码"), "2345");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(screen.getByRole("button", { name: "发送中…" })).toBeDisabled();

    resolveSendCode?.();

    expect(await screen.findByRole("button", { name: "60秒后重发" })).toBeDisabled();
  });

  it("disables the submit button while login is pending", async () => {
    let resolveLogin: (() => void) | undefined;

    auth.loginWithPassword.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const user = userEvent.setup();

    renderLogin();

    await user.type(screen.getByLabelText("手机号或账号"), "admin");
    await user.type(screen.getByLabelText("密码"), "Correct-Horse-Battery-Staple!42");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByRole("button", { name: "登录中…" })).toBeDisabled();

    resolveLogin?.();

    expect(await screen.findByRole("heading", { name: "仪表盘" })).toBeInTheDocument();
  });

  it("shows a safe error when login fails", async () => {
    auth.loginWithPassword.mockRejectedValue(new Error("request failed"));
    const user = userEvent.setup();

    renderLogin();

    await user.type(screen.getByLabelText("手机号或账号"), "admin");
    await user.type(screen.getByLabelText("密码"), "Wrong-Password-Value!42");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("登录失败，请检查账号或凭据");
  });

  it("shows a safe one-time password-change message from navigation state", () => {
    renderLogin([{ pathname: "/login", state: { message: "密码已修改，请重新登录" } }]);

    expect(screen.getByRole("status")).toHaveTextContent("密码已修改，请重新登录");
  });
});
