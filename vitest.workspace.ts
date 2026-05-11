import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/config",
  "packages/db",
  "packages/services",
  "packages/permissions",
  "apps/web",
]);
