import { test, expect } from "@playwright/test";
import { SEED_OWNER_B_CLIENT_NAME } from "./helpers/data";

const OWNER_A_CLIENTS = ["Acme Studio", "Bob Indep", "Globex"];

test.describe("admin clients page — owner A", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("admin clients page shows only owner A clients", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page.getByText(SEED_OWNER_B_CLIENT_NAME)).not.toBeVisible();
    for (const name of OWNER_A_CLIENTS) {
      await expect(page.getByText(name)).toBeVisible();
    }
  });
});

test.describe("admin clients page — owner B", () => {
  test.use({ storageState: "tests/e2e/.auth/owner-b.json" });

  test("admin clients page for owner B shows only owner B clients", async ({ page }) => {
    await page.goto("/admin/clients");
    await expect(page.getByText(SEED_OWNER_B_CLIENT_NAME)).toBeVisible();
    for (const name of OWNER_A_CLIENTS) {
      await expect(page.getByText(name)).not.toBeVisible();
    }
  });
});
