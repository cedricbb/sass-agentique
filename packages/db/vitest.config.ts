import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@saas/db",
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
