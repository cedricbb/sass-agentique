import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@saas/permissions",
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
