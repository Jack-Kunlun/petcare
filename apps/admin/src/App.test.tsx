import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./components/GlobalErrorMessage", () => ({
  GlobalErrorMessage: () => <div data-testid="global-error-root" />,
}));

vi.mock("./pages/Login", () => ({ default: () => "登录路由" }));

vi.mock("./auth/ProtectedRoute", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return { ProtectedRoute: Outlet };
});

vi.mock("./auth/PermissionRoute", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return { PermissionRoute: Outlet };
});

vi.mock("./components/Layout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return { default: Outlet };
});

vi.mock("./pages/OrderManagement/Complaint", () => ({
  default: () => "投诉工作队列路由",
}));

vi.mock("./pages/OrderManagement/Complaint/Detail", () => ({
  default: () => "投诉卷宗详情路由",
}));

vi.mock("./pages/Settings", () => ({ default: () => "系统设置概览路由" }));
vi.mock("./pages/Settings/Edit", () => ({ default: () => "系统设置编辑路由" }));
vi.mock("./pages/Settings/Detail", () => ({ default: () => "系统设置历史详情路由" }));
vi.mock("./pages/Account", () => ({ default: () => "个人中心路由" }));
vi.mock("./pages/ContentManagement/Articles/Edit", () => ({
  default: () => "课堂文章编辑路由",
}));

describe("App complaint routes", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/orders/complaints");
  });

  it("registers the complaint list route without requiring the detail page", async () => {
    render(<App />);

    expect(await screen.findByText("投诉工作队列路由")).toBeInTheDocument();
  });

  it("注册投诉卷宗详情路由", async () => {
    window.history.replaceState({}, "", "/orders/complaints/complaint-1");
    render(<App />);
    expect(await screen.findByText("投诉卷宗详情路由")).toBeInTheDocument();
  });
});

describe("App system settings routes", () => {
  it.each([
    ["/settings", "系统设置概览路由"],
    ["/settings/fee/edit", "系统设置编辑路由"],
    ["/settings/fee/history/fee-v1", "系统设置历史详情路由"],
  ])("注册 %s", async (path, expected) => {
    window.history.replaceState({}, "", path);
    render(<App />);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});

describe("App account route", () => {
  it("renders for an authenticated user without a business permission", async () => {
    window.history.replaceState({}, "", "/account");
    render(<App />);

    expect(await screen.findByText("个人中心路由")).toBeInTheDocument();
  });
});

describe("App classroom article editor routes", () => {
  it.each(["/content/articles/new", "/content/articles/article-1/edit"])(
    "registers the article editor route %s",
    async (path) => {
      window.history.replaceState({}, "", path);
      render(<App />);

      expect(await screen.findByText("课堂文章编辑路由")).toBeInTheDocument();
    },
  );
});

it("keeps the global message root mounted across a redirect to login", async () => {
  window.history.replaceState({}, "", "/account");
  render(<App />);
  expect(screen.getByTestId("global-error-root")).toBeInTheDocument();

  act(() => {
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  expect(screen.getByTestId("global-error-root")).toBeInTheDocument();
});
