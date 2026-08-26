import { defineConfig, devices } from "@playwright/test";

const adminPort = Number(process.env.ADMIN_E2E_ADMIN_PORT || 8986);
const websitePort = Number(process.env.ADMIN_E2E_WEBSITE_PORT || 8080);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${adminPort}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  metadata: {
    websiteURL: `http://127.0.0.1:${websitePort}`,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
