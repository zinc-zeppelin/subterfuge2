import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "USE_LOCAL_STORE=true ALLOW_DEV_MUTATORS=true npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ALLOW_DEV_MUTATORS: "true",
      USE_LOCAL_STORE: "true",
    },
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /.*mobile.*\.spec\.ts/,
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
      testMatch: /.*mobile.*\.spec\.ts/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: /.*mobile.*\.spec\.ts/,
    },
  ],
});
