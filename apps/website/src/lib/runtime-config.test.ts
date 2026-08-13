import { describe, expect, it } from "vitest";
import { getWebsiteRuntimeConfig } from "./runtime-config";

describe("getWebsiteRuntimeConfig", () => {
  it("uses documented local runtime defaults", () => {
    expect(getWebsiteRuntimeConfig({})).toEqual({
      publicUrl: "http://localhost:8080",
      contentApiBaseUrl: "http://localhost:3000",
      lastSuccessTtlMilliseconds: 300_000,
    });
  });

  it("normalizes valid website runtime URLs and a bounded fallback age", () => {
    expect(
      getWebsiteRuntimeConfig({
        WEBSITE_PUBLIC_URL: "https://www.petcare.example/",
        WEBSITE_CONTENT_API_BASE_URL: "https://api.petcare.example/v1/",
        WEBSITE_LAST_SUCCESS_TTL_SECONDS: "120",
      }),
    ).toEqual({
      publicUrl: "https://www.petcare.example",
      contentApiBaseUrl: "https://api.petcare.example/v1",
      lastSuccessTtlMilliseconds: 120_000,
    });
  });

  it.each([
    ["WEBSITE_PUBLIC_URL", "ftp://www.petcare.example"],
    ["WEBSITE_CONTENT_API_BASE_URL", "not a URL"],
    ["WEBSITE_LAST_SUCCESS_TTL_SECONDS", "0"],
  ])("rejects malformed %s values", (name, value) => {
    expect(() => getWebsiteRuntimeConfig({ [name]: value })).toThrow(name);
  });
});
