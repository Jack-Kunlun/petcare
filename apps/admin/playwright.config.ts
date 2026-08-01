import { defineConfig, devices } from "@playwright/test";

const externallyManagedServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8986",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externallyManagedServers
    ? undefined
    : [
        {
          command:
            "node --env-file-if-exists=../../.env node_modules/@nestjs/cli/bin/nest.js start",
          cwd: "../server",
          url: "http://127.0.0.1:3000/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "node node_modules/vite/bin/vite.js --host 127.0.0.1",
          url: "http://127.0.0.1:8986",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
