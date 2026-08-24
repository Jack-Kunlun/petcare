// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
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
const globalErrors = vi.hoisted(() => ({ showApiError: vi.fn() }));

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
vi.mock("../../lib/global-error", () => globalErrors);

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
    vi.useRealTimers();
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auth.loginWithPassword.mockResolvedValue(undefined);
    auth.loginWithSms.mockResolvedValue(undefined);
    auth.sendSmsCode.mockResolvedValue({ message: "sent", cooldownSeconds: 60 });
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

  it("loads captcha only after the send dialog opens", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));

    expect(auth.getCaptcha).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("图形验证码")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));

    expect(await screen.findByRole("dialog", { name: "发送短信验证码" })).toBeInTheDocument();
    expect(auth.getCaptcha).toHaveBeenCalledOnce();
    expect(await screen.findByRole("img", { name: "图形验证码" })).toHaveAttribute(
      "src",
      firstCaptcha.image,
    );
  });

  it("starts from the server cooldown and counts down on the send button", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    auth.sendSmsCode.mockResolvedValue({ message: "sent", cooldownSeconds: 60 });

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));
    await user.type(await screen.findByLabelText("图形验证码"), "2345");
    await user.click(screen.getByRole("button", { name: "确认发送" }));

    expect(auth.sendSmsCode).toHaveBeenCalledWith("13800138000", "0123456789abcdef", "2345");
    expect(screen.getByRole("button", { name: "60秒后重发" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("button", { name: "59秒后重发" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(59_000));
    expect(screen.getByRole("button", { name: "发送验证码" })).toBeEnabled();
  });

  it("keeps captcha out of the final SMS login request", async () => {
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await user.type(screen.getByLabelText("手机号"), "13800138000");

    await user.type(screen.getByLabelText("验证码"), "246810");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(auth.loginWithSms).toHaveBeenCalledWith("13800138000", "246810");
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
    expect(screen.getByTestId("send-code-button")).toHaveClass("h-12");
    expect(screen.getByTestId("sms-code-row")).toHaveClass("h-12", "items-center");
    expect(screen.queryByTestId("captcha-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("send-code-button")).toHaveClass("disabled:cursor-not-allowed");
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

  it("keeps the dialog open and refreshes captcha after an SMS send failure", async () => {
    const failure = { response: { data: { message: "图形验证码错误或已过期" } } };

    auth.getCaptcha.mockResolvedValueOnce(firstCaptcha).mockResolvedValueOnce(secondCaptcha);
    auth.sendSmsCode.mockRejectedValue(failure);
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));
    await user.type(screen.getByLabelText("图形验证码"), "2345");
    await user.click(screen.getByRole("button", { name: "确认发送" }));

    await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
    expect(screen.getByRole("dialog", { name: "发送短信验证码" })).toBeInTheDocument();
    expect(screen.queryByText("验证码发送失败，请稍后重试")).not.toBeInTheDocument();
    expect(screen.getByLabelText("图形验证码")).toHaveValue("");
    await waitFor(() => expect(auth.getCaptcha).toHaveBeenCalledTimes(2));
  });

  it("offers a retry when graphical captcha loading fails", async () => {
    const failure = { response: { data: { message: "图形验证码加载失败" } } };

    auth.getCaptcha.mockRejectedValueOnce(failure).mockResolvedValue(firstCaptcha);
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));
    const retryButton = await screen.findByRole("button", { name: "重新加载图形验证码" });

    await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));

    await user.click(retryButton);

    expect(
      await screen.findByRole("button", { name: "图形验证码，点击换一张" }),
    ).toBeInTheDocument();
    expect(auth.getCaptcha).toHaveBeenCalledTimes(2);
  });

  it("disables confirmation while an SMS code is being sent", async () => {
    let resolveSendCode:
      ((response: { message: string; cooldownSeconds: number }) => void) | undefined;

    auth.sendSmsCode.mockImplementation(
      () =>
        new Promise<{ message: string; cooldownSeconds: number }>((resolve) => {
          resolveSendCode = resolve;
        }),
    );
    const user = userEvent.setup();

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "验证码登录" }));
    await user.type(screen.getByLabelText("手机号"), "13800138000");
    await user.click(screen.getByRole("button", { name: "发送验证码" }));
    await user.type(screen.getByLabelText("图形验证码"), "2345");
    await user.click(screen.getByRole("button", { name: "确认发送" }));

    expect(screen.getByRole("button", { name: "发送中…" })).toBeDisabled();

    resolveSendCode?.({ message: "sent", cooldownSeconds: 60 });

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

  it("routes a failed login through the global API message", async () => {
    const failure = { response: { data: { message: "账号或凭据错误" } } };

    auth.loginWithPassword.mockRejectedValue(failure);
    const user = userEvent.setup();

    renderLogin();

    await user.type(screen.getByLabelText("手机号或账号"), "admin");
    await user.type(screen.getByLabelText("密码"), "Wrong-Password-Value!42");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(globalErrors.showApiError).toHaveBeenCalledWith(failure));
    expect(screen.queryByText("登录失败，请检查账号或凭据")).not.toBeInTheDocument();
  });

  it("shows a safe one-time password-change message from navigation state", () => {
    renderLogin([{ pathname: "/login", state: { message: "密码已修改，请重新登录" } }]);

    expect(screen.getByRole("status")).toHaveTextContent("密码已修改，请重新登录");
  });
});
