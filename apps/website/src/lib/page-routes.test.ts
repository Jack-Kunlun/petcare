import { describe, expect, it } from "vitest";
import { STATIC_MARKETING_PATHS } from "./page-routes";

describe("code-owned page route registry", () => {
  it("contains the formal marketing routes", () => {
    expect(STATIC_MARKETING_PATHS).toEqual(
      expect.arrayContaining(["/", "/product", "/rewards", "/payments", "/help", "/privacy"]),
    );
  });
});
