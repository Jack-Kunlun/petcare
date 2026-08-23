import { describe, expect, it } from "vitest";
import { getBountyMode } from "./bounty-mode";

describe("getBountyMode", () => {
  it("accepts only the explicit map state", () => {
    expect(getBountyMode({ mode: "map" })).toBe("map");
    expect(getBountyMode({ mode: "unknown" })).toBe("list");
    expect(getBountyMode({})).toBe("list");
  });
});
