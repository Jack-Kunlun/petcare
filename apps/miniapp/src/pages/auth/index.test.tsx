import Taro from "@tarojs/taro";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MiniappApiError } from "../../api/request";
import { useAuth } from "../../auth/auth.context";
import AuthPage from ".";

let mockPhoneDetail: { code?: string; errMsg?: string } = {
  code: "phone-code",
};

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getCurrentPages: jest.fn(),
    navigateBack: jest.fn(),
    redirectTo: jest.fn(),
    switchTab: jest.fn(),
    getWindowInfo: jest.fn(() => ({ statusBarHeight: 24 })),
  },
}));

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
    Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("span", props, children),
    Button: ({
      children,
      onClick,
      onGetPhoneNumber,
      loading,
      openType,
      hoverClass,
      ...props
    }: React.PropsWithChildren<{
      onClick?: () => void;
      onGetPhoneNumber?: (event: { detail: { code?: string; errMsg?: string } }) => void;
      loading?: boolean;
      openType?: string;
      hoverClass?: string;
    }>) => {
      void loading;
      void openType;
      void hoverClass;

      return React.createElement(
        "button",
        {
          ...props,
          "data-open-type": openType,
          onClick: onClick ?? (() => onGetPhoneNumber?.({ detail: mockPhoneDetail })),
        },
        children,
      );
    },
    Image: ({ children, ariaLabel, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("img", { ...props, "aria-label": ariaLabel }, children),
  };
});

jest.mock("../../auth/auth.context", () => ({
  useAuth: jest.fn(),
}));

describe("AuthPage", () => {
  const login = jest.fn();
  const bindPhone = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPhoneDetail = { code: "phone-code" };
    jest.mocked(useAuth).mockReturnValue({
      status: "guest",
      user: null,
      login,
      bindPhone,
      logout: jest.fn(),
    });
    jest.mocked(Taro.getCurrentPages).mockReturnValue([{}] as never);
  });

  it("uses the phone authorization code from the same login action", async () => {
    login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });
    bindPhone.mockResolvedValue(undefined);

    render(<AuthPage />);
    const loginButton = screen.getByRole("button", { name: "微信登录" });

    expect(loginButton).toHaveAttribute("data-open-type", "getPhoneNumber");

    fireEvent.click(loginButton);

    await waitFor(() => expect(bindPhone).toHaveBeenCalledWith("bind-token", "phone-code"));
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/index/index" });
  });

  it("renders the immersive PetCare login composition", () => {
    const { container } = render(<AuthPage />);

    expect(container.firstElementChild).toHaveClass(
      "min-h-screen",
      "bg-linear-to-b",
      "from-surface-brand",
      "to-surface",
    );
    expect(screen.getByLabelText("PetCare 宠伴品牌 Logo")).toBeInTheDocument();
    expect(screen.getByText("让每一次托付，都安心可见")).toBeInTheDocument();
    expect(screen.getByText("微信手机号快捷登录")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "微信登录" })).toHaveClass("h-control", "bg-brand");
  });

  it("keeps a stable card height while showing an error", async () => {
    mockPhoneDetail = { errMsg: "getPhoneNumber:fail user deny" };
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: "微信登录" }));

    expect(await screen.findByText("需要授权手机号才能完成登录，请重试")).toBeInTheDocument();
    expect(screen.getByTestId("auth-card")).toHaveClass("min-h-auth-card");
  });

  it("switches to the home tab for an already-bound user", async () => {
    login.mockResolvedValue({
      status: "authenticated",
      accessToken: "access",
      refreshToken: "refresh",
      user: {
        id: "user-1",
        phone: "17679141878",
        nickname: "宠友1878",
        avatar: null,
        userType: "pet_owner",
      },
    });
    render(<AuthPage />);
    fireEvent.click(screen.getByText("微信登录"));

    await waitFor(() => expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/index/index" }));
    expect(Taro.navigateBack).not.toHaveBeenCalled();
  });

  it("binds the authorized phone code", async () => {
    login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });
    bindPhone.mockResolvedValue(undefined);

    render(<AuthPage />);
    fireEvent.click(screen.getByText("微信登录"));

    await waitFor(() => expect(bindPhone).toHaveBeenCalledWith("bind-token", "phone-code"));
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/index/index" });
    expect(Taro.navigateBack).not.toHaveBeenCalled();
  });

  it("shows a retry message when phone authorization is declined", async () => {
    login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });
    mockPhoneDetail = { errMsg: "getPhoneNumber:fail user deny" };

    render(<AuthPage />);
    fireEvent.click(screen.getByText("微信登录"));

    expect(await screen.findByText("需要授权手机号才能完成登录，请重试")).toBeInTheDocument();
    expect(bindPhone).not.toHaveBeenCalled();
  });

  it("restarts WeChat login after a binding challenge expires", async () => {
    login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });
    bindPhone.mockRejectedValue(
      new MiniappApiError("AUTH_BIND_TOKEN_EXPIRED", "expired", "request-1", 401),
    );

    render(<AuthPage />);
    fireEvent.click(screen.getByText("微信登录"));

    expect(await screen.findByText("登录状态已过期，请重新微信登录")).toBeInTheDocument();
    expect(screen.getByText("微信登录")).toBeInTheDocument();
  });

  it("prevents concurrent login attempts", async () => {
    let resolveLogin:
      ((value: { status: "phone_required"; bindToken: string }) => void) | undefined;

    login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    render(<AuthPage />);
    const button = screen.getByText("微信登录");

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "正在登录" })).toBeDisabled();
    fireEvent.click(button);
    expect(login).toHaveBeenCalledTimes(1);

    resolveLogin?.({ status: "phone_required", bindToken: "bind-token" });
    await waitFor(() => expect(bindPhone).toHaveBeenCalledWith("bind-token", "phone-code"));
  });
});
