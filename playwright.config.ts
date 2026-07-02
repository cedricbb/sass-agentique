import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

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
  workers: process.env.CI ? 1 : 2,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: process.env.CI ? "retain-on-failure" : "on",
    video: process.env.CI ? "retain-on-failure" : "on",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-gpu",
      ],
    },
  },

  expect: {
    timeout: process.env.CI ? 10_000 : 7_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      grep: /authenticate admin/,
    },
    {
      name: "setup-owner-b",
      testMatch: /auth\.setup\.ts/,
      grep: /authenticate owner-b/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "chromium-owner-b",
      testMatch: /(clients-isolation|invoices-isolation)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/owner-b.json",
      },
      dependencies: ["setup-owner-b"],
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
      R2_ENDPOINT: process.env.R2_ENDPOINT ?? "",
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
      R2_BUCKET: process.env.R2_BUCKET ?? "saas-reports-dev",
    },
  },
});
