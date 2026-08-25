import type { AdminUserListItem, RbacCatalogResponse, RbacRoleDetail } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
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
  phone: "13800138000",
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

  const router = createMemoryRouter(
    [
      { path: "/rbac/:id", element: <RbacDetail /> },
      { path: "/rbac/:id/edit", element: <div>编辑角色</div> },
      { path: "/rbac", element: <div>角色列表</div> },
    ],
    { initialEntries: ["/rbac/role-operator"] },
  );

  render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );

  return router;
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

  it("uses shared top actions and guards only edited administrator associations", async () => {
    const user = userEvent.setup();

    vi.mocked(rbacApi.fetchRbacRole)
      .mockResolvedValueOnce(role)
      .mockResolvedValue({ ...role, userIds: ["admin-1", "admin-2"], userCount: 2 });
    renderDetail(["rbac.view", "rbac.role.update", "rbac.assign_role"]);
    await screen.findByRole("heading", { name: "运营专员" });
    expect(document.querySelector(".editor-page")).toHaveClass(
      "max-w-[var(--editor-width-default)]",
    );
    const header = within(document.querySelector(".editor-page__header")!);

    expect(header.getByRole("link", { name: "返回角色列表" })).toBeInTheDocument();
    expect(header.getByRole("link", { name: "编辑角色" })).toBeInTheDocument();
    expect(header.getByRole("button", { name: "顶部保存关联管理员" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("关联管理员 ID"));
    await user.type(screen.getByLabelText("关联管理员 ID"), "admin-1\nadmin-2");
    await user.click(header.getByRole("link", { name: "返回角色列表" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("放弃未保存的修改？");
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(header.getByRole("button", { name: "顶部保存关联管理员" }));
    await waitFor(() => expect(rbacApi.replaceRbacRoleUsers).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByLabelText("关联管理员 ID")).toHaveValue("admin-1\nadmin-2"),
    );
    await user.click(header.getByRole("link", { name: "返回角色列表" }));
    expect(await screen.findByText("角色列表")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
