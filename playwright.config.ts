import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3200",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: "npm run server:start",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:2567/health",
    },
    {
      command: "npm start -- -H 127.0.0.1 -p 3200",
      reuseExistingServer: true,
      timeout: 120_000,
      url: "http://127.0.0.1:3200/game",
    },
  ],
});
