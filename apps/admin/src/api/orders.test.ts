import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./auth";
import { fetchAdminOrders } from "./orders";

vi.mock("./auth", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("fetchAdminOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("通过管理员订单接口传递分页和筛选参数", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { list: [], total: 0, page: 2, pageSize: 20 },
    });

    await expect(
      fetchAdminOrders({
        page: 2,
        pageSize: 20,
        keyword: "1767",
        orderType: "reward",
        serviceType: "feeding",
        status: "pending_confirm",
      }),
    ).resolves.toEqual({ list: [], total: 0, page: 2, pageSize: 20 });

    expect(apiClient.get).toHaveBeenCalledWith("/admin/orders", {
      params: {
        page: 2,
        pageSize: 20,
        keyword: "1767",
        orderType: "reward",
        serviceType: "feeding",
        status: "pending_confirm",
      },
    });
  });
});
