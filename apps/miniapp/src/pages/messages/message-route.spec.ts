import { describe, expect, it } from "vitest";
import { getMessageTarget } from "./message-route";

describe("getMessageTarget", () => {
  it("maps actionable messages and leaves system notices inert", () => {
    expect(getMessageTarget("order", "order-1")).toBe("/pages-care/order/detail?id=order-1");
    expect(getMessageTarget("interaction", "user-1")).toBe("/pages-care/chat/index?userId=user-1");
    expect(getMessageTarget("system", "notice-1")).toBeUndefined();
  });
});
