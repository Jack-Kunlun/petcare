import { describe, expect, it } from "vitest";
import {
  formatBasisPointsAsPercent,
  formatCentsAsYuan,
  formatScoreAsStars,
  parsePercentAsBasisPoints,
  parseStarsAsScore,
  parseYuanAsCents,
} from "./form-utils";

describe("system settings display-unit conversions", () => {
  it("converts rating stars without sending decimals to the API", () => {
    expect(formatScoreAsStars(350)).toBe("3.50");
    expect(parseStarsAsScore("3.75")).toBe(375);
    expect(parseStarsAsScore("3.756")).toBeNull();
  });

  it("converts percentages to integer basis points", () => {
    expect(formatBasisPointsAsPercent(1250)).toBe("12.50");
    expect(parsePercentAsBasisPoints("1.25")).toBe(125);
    expect(parsePercentAsBasisPoints("1.255")).toBeNull();
  });

  it("converts yuan to integer cents", () => {
    expect(formatCentsAsYuan(205)).toBe("2.05");
    expect(parseYuanAsCents("2.05")).toBe(205);
    expect(parseYuanAsCents("2.005")).toBeNull();
  });
});
