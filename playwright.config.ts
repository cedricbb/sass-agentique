import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3001";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// En CI on sert le build compilé (next start), plus rapide et stable.
// En local on utilise next dev sur le serveur déjà lancé.
const webServerCommand = process.env.CI
  ? `pnpm --filter @saas/web build && pnpm --filter @saas/web start`
  : `pnpm --filter @saas/web dev`;

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

  webServer: {
    command: webServerCommand,
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
