import { loadEnv } from "vite";
import { describe, expect, it } from "vitest";

describe("miniapp mode environment", () => {
  it.each([
    ["development", "http://localhost:3000"],
    ["production", "https://admin.petcare-home.com/api"],
  ])("loads the native API base URL in %s mode", (mode, expectedBaseUrl) => {
    const env = loadEnv(mode, import.meta.dirname, "VITE_MINIAPP_");

    expect(env.VITE_MINIAPP_API_BASE_URL).toBe(expectedBaseUrl);
  });
});
