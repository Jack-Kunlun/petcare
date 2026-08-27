import { describe, expect, it } from "vitest";
import { getMessageTarget } from "./message-route";

describe("getMessageTarget", () => {
  it("maps actionable messages and leaves system notices inert", () => {
    expect(getMessageTarget("order", "order-1")).toBeUndefined();
    expect(getMessageTarget("interaction", "post-1")).toBe(
      "/pages-content/community/article?id=post-1",
    );
    expect(getMessageTarget("system", "notice-1")).toBeUndefined();
    expect(getMessageTarget("interaction", null)).toBeUndefined();
  });
});
