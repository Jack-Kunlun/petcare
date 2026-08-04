import "@testing-library/jest-dom";
import Taro from "@tarojs/taro";
import { fireEvent, render, screen } from "@testing-library/react";
import CustomTabBar from ".";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getCurrentInstance: jest.fn(),
    switchTab: jest.fn(),
  },
}));

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("button", props, children),
    Icon: ({ ariaLabel, color, type }: { ariaLabel?: string; color?: string; type: string }) =>
      React.createElement("span", {
        role: "img",
        "aria-label": ariaLabel,
        "data-color": color,
        "data-icon": type,
      }),
    Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("span", props, children),
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
  };
});

describe("CustomTabBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(Taro.getCurrentInstance).mockReturnValue({
      router: { path: "/pages/index/index" },
    } as never);
  });

  it("renders five readable icon tabs", () => {
    render(<CustomTabBar />);

    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "首页" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "悬赏大厅" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "首页" })).toBeInTheDocument();
  });

  it("switches to the selected tab route", () => {
    render(<CustomTabBar />);

    fireEvent.click(screen.getByRole("button", { name: "社区" }));

    expect(Taro.switchTab).toHaveBeenCalledWith({ url: "/pages/community/index" });
  });

  it("normalizes Taro routes without a leading slash", () => {
    jest.mocked(Taro.getCurrentInstance).mockReturnValue({
      router: { path: "pages/profile/index" },
    } as never);

    render(<CustomTabBar />);

    expect(screen.getByRole("img", { name: "我的" })).toHaveAttribute("data-color", "#4A6CF7");
  });
});
