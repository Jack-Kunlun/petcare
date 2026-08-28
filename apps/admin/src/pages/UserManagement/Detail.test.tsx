import type { AdminUserDetail } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banAdminUser, fetchAdminUser, restoreAdminUser } from "../../api/users";
import { AuthContext, type AuthContextValue } from "../../auth/auth.context";
import UserDetail from "./Detail";

vi.mock("../../api/users", () => ({
  banAdminUser: vi.fn(),
  fetchAdminUser: vi.fn(),
  restoreAdminUser: vi.fn(),
}));

const activeUser: AdminUserDetail = {
  id: "user-1",
  phone: "13800138000",
  username: "xiaochong",
  nickname: "小宠家长",
  avatar: null,
  userType: "pet_owner",
  status: "active",
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  profile: { bio: "喜欢猫咪" },
  activity: { petCount: 2, postCount: 3, commentCount: 4, favoriteCount: 5 },
};

const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "admin-1",
    username: "operator",
    phone: "13900000001",
    nickname: "系统管理员",
    avatar: null,
    roles: ["super_admin"],
    permissions: ["user.view", "user.update"],
  },
  loginWithPassword: vi.fn(),
  loginWithSms: vi.fn(),
  getCaptcha: vi.fn(),
  sendSmsCode: vi.fn(),
  logout: vi.fn(),
  updateUserSummary: vi.fn(),
  invalidateLocalSession: vi.fn(),
};

function renderPage({
  currentUserId = "admin-1",
  permissions = ["user.view", "user.update"],
}: {
  currentUserId?: string;
  permissions?: string[];
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const context: AuthContextValue = {
    ...auth,
    user: auth.user ? { ...auth.user, id: currentUserId, permissions } : null,
  };

  return render(
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={["/users/user-1"]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/users/:id" element={<UserDetail />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("UserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminUser).mockResolvedValue(activeUser);
    vi.mocked(banAdminUser).mockResolvedValue({ ...activeUser, status: "banned" });
    vi.mocked(restoreAdminUser).mockResolvedValue(activeUser);
  });

  it("展示用户账户、当前状态和使用概况", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "小宠家长", level: 1 })).toBeInTheDocument();
    expect(fetchAdminUser).toHaveBeenCalledWith("user-1");
    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByText("13800138000")).toBeInTheDocument();
    expect(screen.getAllByText("@xiaochong")).toHaveLength(2);
    expect(screen.getByText("喜欢猫咪")).toBeInTheDocument();
    expect(screen.getByText("宠物档案").parentElement).toHaveTextContent("2");
    expect(screen.getByText("社区帖子").parentElement).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "返回用户列表" })).toHaveAttribute("href", "/users");
    expect(screen.getByRole("button", { name: "拉黑用户" })).toBeEnabled();
    expect(screen.queryByText(/住址|实名/)).not.toBeInTheDocument();
  });

  it("确认后拉黑用户并切换为恢复操作", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findByRole("heading", { name: "小宠家长", level: 1 });
    await user.click(screen.getByRole("button", { name: "拉黑用户" }));

    expect(screen.getByRole("dialog", { name: "确认拉黑该用户？" })).toHaveTextContent(
      "所有现有会话会立即失效",
    );
    await user.click(screen.getByRole("button", { name: "确认拉黑" }));

    await waitFor(() => expect(banAdminUser).toHaveBeenCalledWith("user-1"));
    expect(await screen.findByText("已封禁")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "恢复用户" })).toBeEnabled();
  });

  it("确认后恢复已拉黑用户但不复活旧会话", async () => {
    const user = userEvent.setup();

    vi.mocked(fetchAdminUser).mockResolvedValue({ ...activeUser, status: "banned" });
    renderPage();
    await screen.findByText("已封禁");
    await user.click(screen.getByRole("button", { name: "恢复用户" }));

    expect(screen.getByRole("dialog", { name: "确认恢复该用户？" })).toHaveTextContent(
      "旧会话仍保持失效",
    );
    await user.click(screen.getByRole("button", { name: "确认恢复" }));

    await waitFor(() => expect(restoreAdminUser).toHaveBeenCalledWith("user-1"));
    expect(await screen.findByText("正常")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拉黑用户" })).toBeEnabled();
  });

  it("不向缺少更新权限的管理员展示状态操作", async () => {
    renderPage({ permissions: ["user.view"] });

    await screen.findByRole("heading", { name: "小宠家长", level: 1 });
    expect(screen.queryByRole("button", { name: "拉黑用户" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复用户" })).not.toBeInTheDocument();
  });

  it("阻止管理员从界面拉黑当前登录账号", async () => {
    renderPage({ currentUserId: "user-1" });

    await screen.findByRole("heading", { name: "小宠家长", level: 1 });
    expect(screen.getByRole("button", { name: "不可拉黑自己" })).toBeDisabled();
  });
});
