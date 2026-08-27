import { act, render, screen } from "@testing-library/react";
import { isValidElement, StrictMode, type ElementType, type ReactNode } from "react";
import { matchRoutes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App, { createAdminRouter } from "./App";
import { PermissionRoute } from "./auth/PermissionRoute";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import { ADMIN_ROUTE_REGISTRY } from "./routes/registry";

function hasRouteElement(element: ReactNode, type: ElementType) {
  return isValidElement(element) && element.type === type;
}

function renderApp() {
  const router = createAdminRouter();

  void router.navigate(window.location.pathname);

  return render(<App router={router} />);
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

vi.mock("./pages/Account", () => ({ default: () => "个人中心路由" }));
vi.mock("./pages/ContentManagement/Articles/Edit", () => ({
  default: () => "课堂文章编辑路由",
}));

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

describe("App account route", () => {
  it("renders for an authenticated user without a business permission", async () => {
    window.history.replaceState({}, "", "/account");
    renderApp();

    expect(await screen.findByText("个人中心路由")).toBeInTheDocument();
  });
});

describe("App classroom article editor routes", () => {
  it.each(["/content/articles/new", "/content/articles/article-1/edit"])(
    "registers the article editor route %s",
    async (path) => {
      window.history.replaceState({}, "", path);
      renderApp();

      expect(await screen.findByText("课堂文章编辑路由")).toBeInTheDocument();
    },
  );
});

it("keeps the global message root mounted across a redirect to login", async () => {
  window.history.replaceState({}, "", "/account");
  renderApp();
  expect(screen.getByTestId("global-error-root")).toBeInTheDocument();

  act(() => {
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  expect(screen.getByTestId("global-error-root")).toBeInTheDocument();
});

it("creates one browser router when App mounts in StrictMode", async () => {
  window.history.replaceState({}, "", "/login");
  vi.resetModules();

  const routerModule = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  const createBrowserRouter = vi.fn(routerModule.createBrowserRouter);

  vi.doMock("react-router-dom", () => ({ ...routerModule, createBrowserRouter }));

  try {
    const { default: StrictModeApp } = await import("./App");

    render(
      <StrictMode>
        <StrictModeApp />
      </StrictMode>,
    );

    expect(createBrowserRouter).toHaveBeenCalledTimes(1);
  } finally {
    vi.doUnmock("react-router-dom");
    vi.resetModules();
  }
});
