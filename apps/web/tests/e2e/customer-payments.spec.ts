import { test, expect } from "@playwright/test";
import {
  SEED_PAYMENT_INVOICE_NUMBER_ACME,
  SEED_PAYMENT_AMOUNT_TTC_ACME,
  SEED_PAYMENT_METHOD_LABEL_ACME,
} from "@/lib/test-constants";

test.describe("Customer Payments — client-acme", () => {
  test.use({ storageState: "tests/e2e/.auth/acme.json" });

  test("t1_acme_liste_nominal", async ({ page }) => {
    await page.goto("/account/payments");
    await expect(page.getByTestId("payments-table")).toBeVisible();
    await expect(page.getByTestId("payment-row")).toHaveCount(2);
    const row = page
      .getByTestId("payment-row")
      .filter({ hasText: SEED_PAYMENT_INVOICE_NUMBER_ACME });
    await expect(row).toBeVisible();
    await expect(row).toContainText(SEED_PAYMENT_AMOUNT_TTC_ACME);
    await expect(row.getByTestId("payment-method-badge")).toHaveText(
      SEED_PAYMENT_METHOD_LABEL_ACME,
    );
    await row.getByTestId("payment-invoice-link").click();
    await expect(page).toHaveURL(/\/account\/invoices\//);
  });

  test("t3_sidebar_7_items_mes_paiements", async ({ page }) => {
    await page.goto("/account/payments");
    await expect(page.locator("aside nav a")).toHaveCount(7);
    await expect(page.getByText("Mes paiements")).toBeVisible();
  });

  test("t4_cross_client_isolation", async ({ page }) => {
    await page.goto("/account/payments");
    const rows = page.getByTestId("payment-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await expect(page.getByText("INV-2026-002")).not.toBeVisible();
  });
});

test.describe("Customer Payments — client-globex", () => {
  test.use({ storageState: "tests/e2e/.auth/globex.json" });

  test("t2_globex_empty_state", async ({ page }) => {
    await page.goto("/account/payments");
    await expect(page.getByTestId("payments-empty")).toBeVisible();
    await expect(page.getByTestId("payments-empty")).toContainText(
      "Aucun paiement enregistré",
    );
  });
});
