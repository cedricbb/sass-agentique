import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Démarrer le serveur Next.js automatiquement si pas déjà actif
  webServer: {
    command: "pnpm --filter @saas/web dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:password@localhost:5432/saas",
    },
  },
});
