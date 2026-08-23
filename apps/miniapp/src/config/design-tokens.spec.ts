import { describe, expect, it } from "vitest";
import { miniappDesignTokens } from "./design-tokens";

describe("miniappDesignTokens", () => {
  it("keeps color and font-size utility names unambiguous", () => {
    const colorNames = new Set(Object.keys(miniappDesignTokens.colors));
    const conflictingNames = Object.keys(miniappDesignTokens.fontSizes).filter((name) =>
      colorNames.has(name),
    );

    expect(conflictingNames).toEqual([]);
  });
});
