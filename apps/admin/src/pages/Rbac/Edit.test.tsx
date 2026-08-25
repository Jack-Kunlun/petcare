import type { RbacCatalogResponse, RbacRoleDetail } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as rbacApi from "../../api/rbac";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import RbacEdit from "./Edit";

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
      code: "system.config",
      type: "button",
      label: "系统配置",
      module: "system",
      path: null,
      parentCode: "system.view",
      order: 20,
      icon: null,
      impliedApiCodes: ["system.config_action"],
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

const editableRole: RbacRoleDetail = {
  id: "role-operator",
  roleName: "运营专员",
  description: "处理日常运营事务",
  isSystem: false,
  isActive: true,
  permissionCount: 1,
  userCount: 0,
  updatedAt: "2026-08-02T00:00:00.000Z",
  permissionCodes: ["system.view"],
  userIds: [],
};

const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13800138000",
    nickname: "运营主管",
    avatar: null,
    roles: ["operator"],
    permissions: ["rbac.view", "rbac.role.create", "rbac.role.update"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderEdit(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/rbac/new", element: <RbacEdit /> },
      { path: "/rbac/:id/edit", element: <RbacEdit /> },
      { path: "/rbac/:id", element: <div>角色详情</div> },
      { path: "/rbac", element: <div>角色列表</div> },
    ],
    { initialEntries: [path] },
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

describe("RbacEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacApi.fetchRbacCatalog).mockResolvedValue(catalog);
    vi.mocked(rbacApi.fetchRbacRole).mockResolvedValue(editableRole);
    vi.mocked(rbacApi.createRbacRole).mockResolvedValue({
      ...editableRole,
      id: "role-new",
      roleName: "客服专员",
    });
    vi.mocked(rbacApi.updateRbacRole).mockResolvedValue(editableRole);
    vi.mocked(rbacApi.replaceRbacRolePermissions).mockResolvedValue(editableRole);
  });

  it("creates a role then submits only selected menu and button codes", async () => {
    const user = userEvent.setup();

    renderEdit("/rbac/new");
    await screen.findByRole("heading", { name: "新建角色" });

    await user.type(screen.getByLabelText("角色名称"), "客服专员");
    await user.type(screen.getByLabelText("角色说明"), "处理客户咨询");
    await user.click(screen.getByRole("checkbox", { name: "系统设置" }));
    expect(screen.getByText("读取系统接口")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "读取系统接口" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "保存角色" }));

    await waitFor(() =>
      expect(rbacApi.createRbacRole).toHaveBeenCalledWith({
        roleName: "客服专员",
        description: "处理客户咨询",
      }),
    );
    expect(rbacApi.replaceRbacRolePermissions).toHaveBeenCalledWith("role-new", {
      permissionCodes: ["system.view", "system.config"],
    });
  });

  it("renders system roles read-only", async () => {
    vi.mocked(rbacApi.fetchRbacRole).mockResolvedValue({
      ...editableRole,
      isSystem: true,
      roleName: "平台管理员",
    });

    renderEdit("/rbac/role-system/edit");

    expect(await screen.findByText("系统角色不可编辑")).toBeInTheDocument();
    expect(screen.getByLabelText("角色名称")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "系统设置" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "保存角色" })).not.toBeInTheDocument();
  });

  it("reports a 409 conflict without discarding the editor", async () => {
    const user = userEvent.setup();

    vi.mocked(rbacApi.updateRbacRole).mockRejectedValue({ response: { status: 409 } });

    renderEdit("/rbac/role-operator/edit");
    const name = await screen.findByLabelText("角色名称");

    await user.clear(name);
    await user.type(name, "运营协调员");
    await user.click(screen.getByRole("button", { name: "保存角色" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "角色已被其他管理员更新，请刷新后再试。",
    );
    expect(screen.getByLabelText("角色名称")).toHaveValue("运营协调员");
  });

  it("uses the shared layout, guards cancel while dirty, and saves without blocking success navigation", async () => {
    const user = userEvent.setup();

    renderEdit("/rbac/new");
    await screen.findByRole("heading", { name: "新建角色" });
    expect(document.querySelector(".editor-page")).toHaveClass(
      "max-w-[var(--editor-width-default)]",
    );
    expect(
      within(document.querySelector(".editor-page__header")!).getByRole("link", {
        name: "返回角色列表",
      }),
    ).toBeInTheDocument();
    expect(
      within(document.querySelector(".editor-page__header")!).getByRole("button", {
        name: "顶部保存角色",
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("角色名称"), "客服专员");
    expect(
      within(document.querySelector(".editor-page__header")!).getByText("有未保存修改"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "返回角色列表" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("放弃未保存的修改？");
    await user.click(screen.getByRole("button", { name: "继续编辑" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "保存角色" }));
    await waitFor(() => expect(rbacApi.createRbacRole).toHaveBeenCalled());
    expect(await screen.findByText("角色详情")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
