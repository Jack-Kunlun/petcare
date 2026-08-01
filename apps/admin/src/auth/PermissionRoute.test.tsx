import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "./auth.context";
import { PermissionRoute } from "./PermissionRoute";

function renderPermissionRoute(permissions: string[]) {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: {
      id: "admin-1",
      username: "operator",
      phone: "17679141878",
      nickname: "运营管理员",
      roles: ["operator"],
      permissions,
    },
    loginWithPassword: vi.fn(),
    loginWithSms: vi.fn(),
    getCaptcha: vi.fn(),
    sendSmsCode: vi.fn(),
    logout: vi.fn(),
  };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route element={<PermissionRoute requireAll={["system.view"]} />}>
            <Route path="/settings" element={<h1>配置控制台</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("PermissionRoute", () => {
  it("允许拥有全部权限码的管理员进入", () => {
    renderPermissionRoute(["system.view"]);

    expect(screen.getByRole("heading", { name: "配置控制台" })).toBeInTheDocument();
  });

  it("为缺少权限的管理员展示可恢复说明", () => {
    renderPermissionRoute([]);

    expect(screen.getByRole("heading", { name: "没有访问权限" })).toBeInTheDocument();
    expect(screen.getByText("请联系管理员授予 system.view 权限。")).toBeInTheDocument();
  });
});
