import type { RbacRoleListItem } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rbacApi from "../../api/rbac";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import Rbac from ".";

vi.mock("../../api/rbac");

const role: RbacRoleListItem = {
  id: "role-operator",
  roleName: "运营专员",
  description: "处理日常运营事务",
  isSystem: false,
  isActive: true,
  permissionCount: 3,
  userCount: 2,
  updatedAt: "2026-08-02T00:00:00.000Z",
};

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营主管",
    roles: ["operator"],
    permissions: [],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
};

function renderPage(permissions: string[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    ...baseAuth,
    user: baseAuth.user ? { ...baseAuth.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Rbac />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("Rbac role management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacApi.fetchRbacRoles).mockResolvedValue({
      list: [role],
      total: 11,
      page: 1,
      pageSize: 10,
    });
  });

  it("loads the role page and paginates roles", async () => {
    const user = userEvent.setup();

    renderPage(["rbac.view"]);

    expect(await screen.findByRole("heading", { name: "角色管理" })).toBeInTheDocument();
    expect(await screen.findByText("运营专员")).toBeInTheDocument();
    expect(rbacApi.fetchRbacRoles).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getByText("第 1 / 2 页，每页 10 条")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() =>
      expect(rbacApi.fetchRbacRoles).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 }),
    );
  });

  it("renders role mutation controls only for their exact permissions", async () => {
    renderPage(["rbac.view", "rbac.role.create", "rbac.role.update", "rbac.role.delete"]);
    await screen.findByText("运营专员");

    expect(screen.getByRole("link", { name: "新建角色" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "编辑 运营专员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除 运营专员" })).toBeInTheDocument();
  });
});
