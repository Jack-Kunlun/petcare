import type { PublicOrder, PublicOrderListResponse } from "@petcare/shared-types";
import type { AxiosInstance } from "axios";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { OrderAPI } from "./order";

const publicOrder: PublicOrder = {
  id: "order-1",
  orderType: "reward",
  serviceType: "feeding",
  serviceTime: "2026-08-01T10:00:00.000Z",
  amount: 12500,
  status: "pending_confirm",
  owner: { nickname: "豆包家长", avatar: null },
  pet: { name: "豆包", breed: "英短", coverImage: null },
};

describe("OrderAPI public reads", () => {
  it("returns the anonymous-safe list and detail contracts", async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ data: { list: [publicOrder], total: 1, page: 1, pageSize: 20 } })
      .mockResolvedValueOnce({ data: publicOrder });
    const api = new OrderAPI({ get } as unknown as AxiosInstance);

    await expect(api.getOrderList({ page: 1, pageSize: 20 })).resolves.toEqual({
      list: [publicOrder],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    await expect(api.getOrderDetail("order-1")).resolves.toEqual(publicOrder);
    expect(get).toHaveBeenNthCalledWith(1, "/orders", {
      params: { page: 1, pageSize: 20 },
    });
    expect(get).toHaveBeenNthCalledWith(2, "/orders/order-1");
    expectTypeOf<ReturnType<OrderAPI["getOrderList"]>>().toEqualTypeOf<
      Promise<PublicOrderListResponse>
    >();
    expectTypeOf<ReturnType<OrderAPI["getOrderDetail"]>>().toEqualTypeOf<Promise<PublicOrder>>();
  });
});
