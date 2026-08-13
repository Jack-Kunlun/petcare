import type { AdminUserListItem, RbacCatalogResponse, RbacRoleDetail } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rbacApi from "../../api/rbac";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import RbacDetail from "./Detail";
import { replaceRbacRoleUsersForRole } from "./role-users-utils";

vi.mock("../../api/rbac");

const catalog: RbacCatalogResponse = {
  version: "2026-08-02",
  permissions: [
    {
      code: "system.view",
      type: "menu",
      label: "系统设置",
      module: "system",
      path: "/settings",
      parentCode: null,
      order: 10,
      icon: "Settings",
      impliedApiCodes: ["system.read"],
    },
    {
      code: "system.read",
      type: "api",
      label: "读取系统接口",
      module: "system",
      path: null,
      parentCode: null,
      order: 10,
      icon: null,
      impliedApiCodes: [],
    },
  ],
};
const role: RbacRoleDetail = {
  id: "role-operator",
  roleName: "运营专员",
  description: "处理日常运营事务",
  isSystem: false,
  isActive: true,
  permissionCount: 1,
  userCount: 1,
  updatedAt: "2026-08-02T00:00:00.000Z",
  permissionCodes: ["system.view"],
  userIds: ["admin-1"],
};
const assignedUser: AdminUserListItem = {
  id: "admin-1",
  phone: "17679141878",
  username: "operator",
  nickname: "运营主管",
  avatar: null,
  userType: "pet_owner",
  status: "active",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  provider: null,
};

const baseAuth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-root",
    username: "root",
    phone: "17600000000",
    nickname: "平台管理员",
    avatar: null,
    roles: ["root"],
    permissions: ["rbac.view"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderDetail(permissions = ["rbac.view"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    ...baseAuth,
    user: baseAuth.user ? { ...baseAuth.user, permissions } : null,
  };

  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/rbac/role-operator"]}>
          <Routes>
            <Route path="/rbac/:id" element={<RbacDetail />} />
            <Route path="/rbac/:id/edit" element={<div>编辑角色</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe("RbacDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacApi.fetchRbacCatalog).mockResolvedValue(catalog);
    vi.mocked(rbacApi.fetchRbacRole).mockResolvedValue(role);
    vi.mocked(rbacApi.fetchRbacRoleUsers).mockResolvedValue([assignedUser]);
    vi.mocked(rbacApi.replaceRbacRoleUsers).mockResolvedValue([assignedUser]);
  });

  it("shows role metadata, effective permissions, catalog version, and associated administrators", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "运营专员" })).toBeInTheDocument();
    expect(screen.getByText("目录版本：2026-08-02")).toBeInTheDocument();
    expect(screen.getByText("系统设置")).toBeInTheDocument();
    expect(screen.getByText("读取系统接口（自动派生）")).toBeInTheDocument();
    expect(screen.getByText("运营主管")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存关联管理员" })).not.toBeInTheDocument();
  });

  it("only shows association replacement to rbac.assign_role and submits replacement IDs", async () => {
    const user = userEvent.setup();

    renderDetail(["rbac.view", "rbac.assign_role"]);
    await screen.findByRole("heading", { name: "运营专员" });

    const input = screen.getByLabelText("关联管理员 ID");

    await user.clear(input);
    await user.type(input, "admin-1\nadmin-2");
    await user.click(screen.getByRole("button", { name: "保存关联管理员" }));

    await waitFor(() =>
      expect(rbacApi.replaceRbacRoleUsers).toHaveBeenCalledWith("role-operator", {
        userIds: ["admin-1", "admin-2"],
      }),
    );
  });

  it("hides association replacement without permission and handles a 409 conflict", async () => {
    const user = userEvent.setup();

    vi.mocked(rbacApi.replaceRbacRoleUsers).mockRejectedValue({ response: { status: 409 } });
    renderDetail(["rbac.view", "rbac.assign_role"]);
    await screen.findByRole("heading", { name: "运营专员" });

    await user.click(screen.getByRole("button", { name: "保存关联管理员" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("关联管理员已变更，请刷新后再试。");
  });

  it("keeps system-role association editing read-only even with rbac.assign_role", async () => {
    vi.mocked(rbacApi.fetchRbacRole).mockResolvedValue({ ...role, isSystem: true });

    renderDetail(["rbac.view", "rbac.assign_role"]);

    expect(await screen.findByRole("heading", { name: "运营专员" })).toBeInTheDocument();
    expect(screen.queryByLabelText("关联管理员 ID")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存关联管理员" })).not.toBeInTheDocument();
    expect(rbacApi.replaceRbacRoleUsers).not.toHaveBeenCalled();
  });

  it("guards the extracted association save seam for system roles", async () => {
    const replace = vi.fn().mockResolvedValue([assignedUser]);

    await replaceRbacRoleUsersForRole({ ...role, isSystem: true }, role.id, ["admin-2"], replace);

    expect(replace).not.toHaveBeenCalled();
  });
});
