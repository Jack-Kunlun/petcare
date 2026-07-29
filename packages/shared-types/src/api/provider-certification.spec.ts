import { describe, expect, it } from "vitest";
import { PROVIDER_CERTIFICATION_STATUS } from "./provider-certification";

describe("provider certification contract", () => {
  it("exports the complete review statuses", () => {
    expect(Object.values(PROVIDER_CERTIFICATION_STATUS)).toEqual([
      "pending",
      "approved",
      "rejected",
    ]);
  });
});
