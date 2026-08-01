import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminOrders } from "../../api/orders";
import OrderManagement from ".";

vi.mock("../../api/orders", () => ({
  fetchAdminOrders: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orders"]}>
        <OrderManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrderManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminOrders).mockResolvedValue({
      list: [
        {
          id: "order-12345678",
          orderType: "reward",
          serviceType: "feeding",
          ownerId: "owner-1",
          providerId: null,
          petId: "pet-1",
          serviceTime: "2026-07-30T08:00:00.000Z",
          address: "南昌市红谷滩区",
          amount: 88,
          status: "pending_confirm",
          remark: null,
          completedAt: null,
          createdAt: "2026-07-29T00:00:00.000Z",
          updatedAt: "2026-07-29T00:00:00.000Z",
          owner: {
            id: "owner-1",
            phone: "17679141878",
            username: "owner",
            nickname: "豆包家长",
            avatar: null,
            userType: "pet_owner",
            status: "active",
          },
          provider: null,
          pet: {
            id: "pet-1",
            name: "豆包",
            breed: "英短",
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("从真实订单接口展示分页列表", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "订单管理" })).toBeInTheDocument();
    expect((await screen.findAllByText("豆包家长"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("豆包 · 英短")[0]).toBeInTheDocument();
    expect(screen.getAllByText("¥88.00")[0]).toBeInTheDocument();
    expect(screen.getByText("共 1 笔订单")).toBeInTheDocument();
    expect(fetchAdminOrders).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      keyword: undefined,
      orderType: undefined,
      serviceType: undefined,
      status: undefined,
    });
  });

  it("展示订单列表与投诉与纠纷的二级导航", () => {
    renderPage();

    expect(screen.getByRole("navigation", { name: "订单管理二级导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "订单列表" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "投诉与纠纷" })).toHaveAttribute(
      "href",
      "/orders/complaints",
    );
  });

  it("选择订单状态后重新查询第一页", async () => {
    const user = userEvent.setup();

    renderPage();
    await screen.findAllByText("豆包家长");
    await user.selectOptions(screen.getByRole("combobox", { name: "订单状态" }), "completed");

    expect(fetchAdminOrders).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      keyword: undefined,
      orderType: undefined,
      serviceType: undefined,
      status: "completed",
    });
  });
});
