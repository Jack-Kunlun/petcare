import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnv } from "vite";
import { describe, expect, it } from "vitest";

describe("miniapp mode environment", () => {
  it.each([
    ["development", ".env.development", "http://localhost:3000"],
    ["production", ".env.production", "https://admin.petcare-home.com/api"],
  ])("loads the native API base URL in %s mode", (mode, sourceFile, expectedBaseUrl) => {
    const isolatedEnvDirectory = mkdtempSync(join(tmpdir(), "petcare-miniapp-env-"));

    try {
      copyFileSync(
        resolve(import.meta.dirname, sourceFile),
        resolve(isolatedEnvDirectory, sourceFile),
      );

      const env = loadEnv(mode, isolatedEnvDirectory, "VITE_");

      expect(env.VITE_MINIAPP_API_BASE_URL).toBe(expectedBaseUrl);
      expect(env.VITE_COMMERCIAL_SERVICES_ENABLED).toBe("false");
    } finally {
      rmSync(isolatedEnvDirectory, { force: true, recursive: true });
    }
  });
});
