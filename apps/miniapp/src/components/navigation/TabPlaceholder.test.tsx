import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import TabPlaceholder from "./TabPlaceholder";

jest.mock("@tarojs/components", () => {
  const React = jest.requireActual("react");

  return {
    Icon: ({ ariaLabel, type }: { ariaLabel?: string; type: string }) =>
      React.createElement("span", {
        role: "img",
        "aria-label": ariaLabel,
        "data-icon": type,
      }),
    Text: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("span", props, children),
    View: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement("div", props, children),
  };
});

describe("TabPlaceholder", () => {
  it("renders the tab title and empty-state guidance", () => {
    render(<TabPlaceholder title="消息" description="新的订单和互动消息会显示在这里" />);

    expect(screen.getByText("消息")).toBeInTheDocument();
    expect(screen.getByText("新的订单和互动消息会显示在这里")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "消息" })).toBeInTheDocument();
  });
});
