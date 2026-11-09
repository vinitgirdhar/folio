import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 65000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1050 },
      },
    },
  ],
  webServer: {
    command: "npx tsx server.ts --production",
    url: "http://127.0.0.1:3100/api/trades",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: "3100",
      DATABASE_PATH: "./test-results/e2e.sqlite",
      MOCK_DELAY_MS: "0",
    },
  },
});
