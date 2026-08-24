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

  it("defines semantic spacing for page, card, section, and navigation grids", () => {
    expect(miniappDesignTokens.spacing["page-horizontal"]).toBe("16px");
    expect(miniappDesignTokens.spacing["navigation-horizontal"]).toBe("16px");
    expect(miniappDesignTokens.spacing["card-padding"]).toBe("16px");
    expect(miniappDesignTokens.spacing["section-gap"]).toBe("24px");
  });
});
