import { act, render, screen } from "@testing-library/react";
import { isValidElement, type ElementType, type ReactNode } from "react";
import { matchRoutes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App, { createAdminRouter } from "./App";
import { PermissionRoute } from "./auth/PermissionRoute";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import { ADMIN_ROUTE_REGISTRY } from "./routes/registry";

function hasRouteElement(element: ReactNode, type: ElementType) {
  return isValidElement(element) && element.type === type;
}

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

describe("createAdminRouter", () => {
  it("keeps login, the protected layout, and every registry route reachable through the Data Router", () => {
    window.history.replaceState({}, "", "/login");
    const router = createAdminRouter();

    const loginMatches = matchRoutes(router.routes, "/login");

    expect(loginMatches?.[loginMatches.length - 1]?.route.path).toBe("/login");

    for (const route of ADMIN_ROUTE_REGISTRY) {
      const path = route.path
        .replace(":contentKey", "home")
        .replace(":versionId", "version-1")
        .replace(":domain", "fee")
        .replace(":id", "record-1");

      const match = matchRoutes(router.routes, path);
      const lastMatch = match?.[match.length - 1];

      if (route.path === "/") {
        expect(lastMatch?.route.index).toBe(true);
      } else {
        expect(lastMatch?.route.path).toBe(route.path);
      }
    }

    router.dispose();
  });

  it("preserves PermissionRoute around every registry entry", () => {
    const router = createAdminRouter();
    const protectedRoute = router.routes.find((route) =>
      hasRouteElement(route.element, ProtectedRoute),
    );
    const layoutRoute = protectedRoute?.children?.find((route) =>
      hasRouteElement(route.element, Layout),
    );

    expect(layoutRoute?.children).toHaveLength(ADMIN_ROUTE_REGISTRY.length);

    for (const route of layoutRoute?.children ?? []) {
      expect(hasRouteElement(route.element, PermissionRoute)).toBe(true);
    }

    router.dispose();
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
