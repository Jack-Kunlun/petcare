import Taro from "@tarojs/taro";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import StatusBarSpacer from "./StatusBarSpacer";

jest.mock("@tarojs/taro", () => ({
  __esModule: true,
  default: { getWindowInfo: jest.fn() },
}));

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
  };
});

it("uses the current WeChat status bar height", () => {
  jest.mocked(Taro.getWindowInfo).mockReturnValue({ statusBarHeight: 24 } as never);

  render(<StatusBarSpacer />);

  expect(screen.getByTestId("status-bar-spacer")).toHaveStyle({ height: "24px" });
});

it("falls back to zero when status bar height is unavailable", () => {
  jest.mocked(Taro.getWindowInfo).mockReturnValue({} as never);

  render(<StatusBarSpacer />);

  expect(screen.getByTestId("status-bar-spacer")).toHaveStyle({ height: "0px" });
});
