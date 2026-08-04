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
      ...props
    }: React.PropsWithChildren<{
      onClick?: () => void;
      onGetPhoneNumber?: (event: { detail: { code?: string; errMsg?: string } }) => void;
      loading?: boolean;
      openType?: string;
    }>) => {
      void loading;
      void openType;

      return React.createElement(
        "button",
        {
          ...props,
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

  it("shows phone authorization only after a first-time login", async () => {
    login.mockResolvedValue({
      status: "phone_required",
      bindToken: "bind-token",
    });

    render(<AuthPage />);
    fireEvent.click(screen.getByText("微信登录"));

    expect(await screen.findByText("授权手机号并登录")).toBeInTheDocument();
  });

  it("uses semantic Tailwind tokens without unsafe syntax", () => {
    const { container } = render(<AuthPage />);

    expect(container.firstElementChild).toHaveClass(
      "min-h-screen",
      "bg-surface-muted",
      "px-section",
      "py-page-y",
    );
    expect(screen.getByText("登录 PetCare 宠伴")).toHaveClass("text-heading", "text-ink-strong");
    expect(screen.getByText("微信登录")).toHaveClass("rounded-button", "bg-brand");
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
    fireEvent.click(await screen.findByText("授权手机号并登录"));

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
    fireEvent.click(await screen.findByText("授权手机号并登录"));

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
    fireEvent.click(await screen.findByText("授权手机号并登录"));

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
    fireEvent.click(button);
    expect(login).toHaveBeenCalledTimes(1);

    resolveLogin?.({ status: "phone_required", bindToken: "bind-token" });
    expect(await screen.findByText("授权手机号并登录")).toBeInTheDocument();
  });
});
