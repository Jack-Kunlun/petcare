import type { AdminContentRewardListItem } from "@petcare/shared-types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminContentRewards } from "../../api/content/rewards";
import ContentManagement from ".";

vi.mock("../../api/content/rewards", () => ({ fetchAdminContentRewards: vi.fn() }));

const reward: AdminContentRewardListItem = {
  id: "reward-1",
  serviceType: "feeding",
  owner: { id: "user-1", phone: "17679141878", username: "owner", nickname: "小明", avatar: null },
  pet: { id: "pet-1", name: "团团", breed: "金毛" },
  rewardAmount: 125,
  status: "pending_confirm",
  serviceTime: "2026-08-01T10:00:00.000Z",
  createdAt: "2026-08-01T09:00:00.000Z",
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/content"]}>
        <ContentManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ContentManagement", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminContentRewards).mockResolvedValue({
      list: [reward],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("renders the real reward list and unified pagination summary", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "悬赏管理" })).toBeTruthy();
    expect(await screen.findByText("小明")).toBeTruthy();
    expect(screen.getByText("团团")).toBeTruthy();
    expect(screen.getByText("¥125.00")).toBeTruthy();
    expect(screen.getByText("第 1 / 1 页，共 1 条")).toBeTruthy();
  });

  it("resets the page and sends filters after searching", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("小明");

    await user.type(screen.getByRole("searchbox", { name: "搜索悬赏" }), "团团");
    await user.selectOptions(screen.getByRole("combobox", { name: "履约状态" }), "completed");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(fetchAdminContentRewards).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      keyword: "团团",
      serviceType: undefined,
      status: "completed",
    });
  });
});
