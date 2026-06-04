import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3001";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "admin-portal",
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/admin.json" },
      testMatch: /admin-.*\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "customer-portal",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: process.env.CI
      ? `pnpm --filter @saas/web build && pnpm --filter @saas/web start`
      : `pnpm --filter @saas/web dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:password@localhost:5432/saas",
    },
  },
});
