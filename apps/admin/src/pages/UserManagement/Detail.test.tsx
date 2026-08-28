import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminUser } from "../../api/users";
import UserDetail from "./Detail";

vi.mock("../../api/users", () => ({
  fetchAdminUser: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter initialEntries={["/users/user-1"]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/users/:id" element={<UserDetail />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("UserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminUser).mockResolvedValue({
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
    });
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
    expect(screen.queryByText(/住址|实名/)).not.toBeInTheDocument();
  });
});
