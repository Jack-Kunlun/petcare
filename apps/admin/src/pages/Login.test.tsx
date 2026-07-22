import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "./Login";

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

vi.mock("../auth/auth.context", () => ({
  useAuth: () => ({
    status: "anonymous",
    user: null,
    logout: vi.fn(),
    ...auth,
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<h1>仪表盘</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Login", () => {
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

  it("shows a safe error when login fails", async () => {
    auth.loginWithPassword.mockRejectedValue(new Error("request failed"));
    const user = userEvent.setup();

    renderLogin();

    await user.type(screen.getByLabelText("手机号或账号"), "admin");
    await user.type(screen.getByLabelText("密码"), "Wrong-Password-Value!42");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("登录失败，请检查账号或凭据");
  });
});
