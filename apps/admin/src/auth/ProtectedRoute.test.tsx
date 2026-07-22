import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "./auth.api";
import { AuthProvider } from "./AuthProvider";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("./auth.api", () => ({
  clearAccessToken: vi.fn(),
  getCurrentUser: vi.fn(),
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  sendSmsCode: vi.fn(),
  setAccessToken: vi.fn(),
}));

function renderRoute() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="/login" element={<h1>登录 PetCare</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/users" element={<h1>用户管理</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders protected content after session restoration", async () => {
    vi.mocked(authApi.refreshSession).mockResolvedValue({ accessToken: "access" });
    vi.mocked(authApi.getCurrentUser).mockResolvedValue({
      id: "user-1",
      username: "admin",
      phone: "17679141878",
      nickname: "系统管理员",
      roles: ["super_admin"],
    });

    renderRoute();

    expect(screen.getByText("正在恢复登录状态…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "用户管理" })).toBeInTheDocument();
  });

  it("redirects an anonymous user to login", async () => {
    vi.mocked(authApi.refreshSession).mockRejectedValue(new Error("unauthorized"));

    renderRoute();

    expect(await screen.findByRole("heading", { name: "登录 PetCare" })).toBeInTheDocument();
  });
});
