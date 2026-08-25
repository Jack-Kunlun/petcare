import { describe, expect, expectTypeOf, it } from "vitest";
import type { OrderStatus, OrderType, ServiceType } from "../enums";
import type { OrderListResponse, PublicOrder, PublicOrderListResponse } from "./order";
import type { PaginatedResponse } from "./response";

describe("public order contract", () => {
  it("contains only anonymous display fields", () => {
    expectTypeOf<PublicOrder>().toEqualTypeOf<{
      id: string;
      orderType: OrderType;
      serviceType: ServiceType;
      serviceTime: string;
      amount: number;
      status: OrderStatus;
      owner: { nickname: string; avatar: string | null };
      pet: { name: string; breed: string; coverImage: string | null };
    }>();
    expectTypeOf<PublicOrderListResponse>().toEqualTypeOf<PaginatedResponse<PublicOrder>>();
    expectTypeOf<OrderListResponse>().toEqualTypeOf<PublicOrderListResponse>();

    const order = {
      id: "order-1",
      orderType: "reward" as OrderType,
      serviceType: "feeding" as ServiceType,
      serviceTime: "2026-08-01T10:00:00.000Z",
      amount: 12500,
      status: "pending_confirm" as OrderStatus,
      owner: { nickname: "豆包家长", avatar: null },
      pet: { name: "豆包", breed: "英短", coverImage: null },
    } satisfies PublicOrder;

    expect(Object.keys(order).sort()).toEqual([
      "amount",
      "id",
      "orderType",
      "owner",
      "pet",
      "serviceTime",
      "serviceType",
      "status",
    ]);
  });
});
