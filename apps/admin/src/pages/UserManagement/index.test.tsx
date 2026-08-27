import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminUsers } from "../../api/users";
import UserManagement from ".";

vi.mock("../../api/users", () => ({
  fetchAdminUsers: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={["/users"]}>
      <QueryClientProvider client={queryClient}>
        <UserManagement />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("UserManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminUsers).mockResolvedValue({
      list: [
        {
          id: "user-1",
          phone: "13800138000",
          username: "xiaochong",
          nickname: "小宠家长",
          avatar: null,
          userType: "pet_owner",
          status: "active",
          createdAt: "2026-07-29T00:00:00.000Z",
          updatedAt: "2026-07-29T00:00:00.000Z",
          provider: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("从真实用户接口展示分页列表", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "用户资料" })).toBeInTheDocument();
    expect((await screen.findAllByText("小宠家长"))[0]).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "13800138000" })).toBeInTheDocument();
    expect(screen.getByText("共 1 位用户")).toBeInTheDocument();
    expect(fetchAdminUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      keyword: undefined,
      userType: undefined,
      status: undefined,
    });
    expect(screen.queryByText("宠托师")).not.toBeInTheDocument();
    expect(screen.queryByText("认证状态")).not.toBeInTheDocument();
  });

  it("提交关键词后重新查询第一页", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findAllByText("小宠家长");

    await user.type(screen.getByRole("searchbox", { name: "搜索用户" }), "1767");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(fetchAdminUsers).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      keyword: "1767",
      userType: undefined,
      status: undefined,
    });
  });
});
