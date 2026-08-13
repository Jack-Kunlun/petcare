import { describe, expect, it } from "vitest";
import config from "../astro.config.mjs";

describe("website Astro configuration", () => {
  it("uses the standalone Node SSR adapter", () => {
    expect(config.output).toBe("server");
    expect(config.adapter?.name).toBe("@astrojs/node");
  });
});
