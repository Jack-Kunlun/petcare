import { describe, expect, it } from "vitest";
import config from "../astro.config.mjs";

describe("website Astro configuration", () => {
  it("uses the standalone Node SSR adapter", () => {
    expect(config.output).toBe("server");
    expect(config.adapter?.name).toBe("@astrojs/node");
  });

  it("loads the CommonJS shared contract package through Node during SSR", () => {
    expect(config.vite?.ssr?.external).toContain("@petcare/shared-types");
  });

  it("uses the same local development origin that the Server puts in preview URLs", () => {
    expect(config.server).toMatchObject({ port: 8080 });
  });
});
