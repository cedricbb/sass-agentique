import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "@saas/web",
    environment: "node",
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**", "**/dist/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
});
