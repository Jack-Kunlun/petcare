import Taro from "@tarojs/taro";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "../../auth/auth.context";
import Index from ".";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: { navigateTo: jest.fn() },
}));

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
    Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("span", props, children),
    Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("button", props, children),
  };
});

jest.mock("../../auth/auth.context", () => ({
  useAuth: jest.fn(),
}));

describe("Index Page", () => {
  const logout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    logout.mockResolvedValue(undefined);
  });

  it("shows the session restore state", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "loading",
      user: null,
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    render(<Index />);

    expect(screen.getByText("正在恢复登录状态…")).toBeInTheDocument();
  });

  it("lets a guest navigate to WeChat login", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "guest",
      user: null,
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    render(<Index />);
    fireEvent.click(screen.getByText("微信登录"));

    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: "/pages/auth/index",
    });
  });

  it("uses Miniapp-safe Tailwind tokens", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "guest",
      user: null,
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    const { container } = render(<Index />);

    expect(container.firstElementChild).toHaveClass("box-border", "flex", "min-h-screen", "p-page");
    expect(screen.getByText("PetCare宠伴")).toHaveClass("text-hero", "text-ink");
    expect(screen.getByText("微信登录")).toHaveClass("w-action", "rounded-button", "bg-brand");
  });

  it("shows the current user and logs out", () => {
    jest.mocked(useAuth).mockReturnValue({
      status: "authenticated",
      user: {
        id: "user-1",
        phone: "17679141878",
        nickname: "宠友1878",
        avatar: null,
        userType: "pet_owner",
      },
      login: jest.fn(),
      bindPhone: jest.fn(),
      logout,
    });

    render(<Index />);
    fireEvent.click(screen.getByText("退出登录"));

    expect(screen.getByText(/宠友1878/)).toBeInTheDocument();
    expect(logout).toHaveBeenCalled();
  });
});
