import "@testing-library/jest-dom";
import Taro from "@tarojs/taro";
import { fireEvent, render, screen } from "@testing-library/react";
import CustomTabBar from ".";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: {
    getCurrentInstance: jest.fn(),
    getWindowInfo: jest.fn(() => ({ screenHeight: 844, safeArea: { bottom: 810 } })),
    switchTab: jest.fn(),
  },
}));

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("button", props, children),
    Image: ({ ...props }: Record<string, unknown>) => React.createElement("img", props),
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
    expect(screen.getAllByRole("img")).toHaveLength(5);
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

    expect(screen.getByRole("button", { name: "我的" })).toHaveAttribute("data-selected", "true");
  });

  it("uses branded local icons and shows the message badge", () => {
    render(<CustomTabBar />);

    expect(screen.getByLabelText("首页")).toHaveAttribute("data-selected", "true");
    expect(screen.getByLabelText("消息未读 3 条")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });

  it("keeps every tab touch target at the semantic control height", () => {
    render(<CustomTabBar />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("min-h-control");
    }
  });

  it("uses the device bottom safe area for the tab bar padding", () => {
    render(<CustomTabBar />);

    expect(screen.getByTestId("custom-tab-bar")).toHaveStyle({ paddingBottom: "34px" });
  });
});
