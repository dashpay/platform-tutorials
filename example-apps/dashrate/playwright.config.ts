import { defineConfig, devices } from "@playwright/test";

const PORT = 5182;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
