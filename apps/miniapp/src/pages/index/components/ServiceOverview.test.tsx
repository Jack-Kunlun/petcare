import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { HOME_ONGOING_SERVICE } from "../home.data";
import ServiceOverview from "./ServiceOverview";

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

describe("ServiceOverview", () => {
  it.each([
    ["loading", null, "正在恢复登录状态"],
    ["guest", null, "登录后管理照护计划"],
    ["authenticated", null, "暂无进行中的服务"],
  ] as const)("renders the %s service state", (status, service, expectedText) => {
    render(
      <ServiceOverview
        status={status}
        service={service}
        onLogin={jest.fn()}
        onPublish={jest.fn()}
        onViewService={jest.fn()}
        onContact={jest.fn()}
      />,
    );

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("renders the ongoing service progress and actions", () => {
    render(
      <ServiceOverview
        status="authenticated"
        service={HOME_ONGOING_SERVICE}
        onLogin={jest.fn()}
        onPublish={jest.fn()}
        onViewService={jest.fn()}
        onContact={jest.fn()}
      />,
    );

    expect(screen.getByText("上门喂养 · 第 2 次服务")).toBeInTheDocument();
    expect(screen.getByTestId("service-progress")).toHaveStyle({ width: "65%" });
  });
});
