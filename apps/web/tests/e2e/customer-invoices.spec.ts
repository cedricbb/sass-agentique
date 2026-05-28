import { test, expect } from "@playwright/test";

test.describe("Customer Invoices — client-acme", () => {
  test.use({ storageState: "e2e/.auth/acme.json" });

  test("voit INV-2026-004 dans la liste", async ({ page }) => {
    await page.goto("/account/invoices");
    const row = page.getByTestId("invoice-row").filter({ hasText: "INV-2026-004" });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("invoice-status-badge")).toHaveText("Envoyée");
  });

  test("ne voit pas INV-2026-001 (draft)", async ({ page }) => {
    await page.goto("/account/invoices");
    await expect(page.getByText("INV-2026-001")).not.toBeVisible();
  });

  test("ne voit pas INV-2026-002 (bob)", async ({ page }) => {
    await page.goto("/account/invoices");
    await expect(page.getByText("INV-2026-002")).not.toBeVisible();
  });

  test("détail INV-2026-004 → 200 read-only", async ({ page }) => {
    await page.goto("/account/invoices");
    await page.getByTestId("invoice-link").filter({ hasText: "INV-2026-004" }).click();
    await expect(page.getByTestId("invoice-detail")).toBeVisible();
    await expect(page.getByTestId("invoice-amounts-card")).toBeVisible();
    await expect(page.getByTestId("invoice-amount-ht")).toBeVisible();
    await expect(page.getByTestId("invoice-amount-vat")).toBeVisible();
    await expect(page.getByTestId("invoice-amount-ttc")).toBeVisible();
    await expect(page.getByTestId("invoice-balance-card")).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
  });

  test("URL directe draft INV-2026-001 → 404", async ({ page }) => {
    const draftInvoiceId = "SEED_DRAFT_INVOICE_ID";
    await page.goto(`/account/invoices/${draftInvoiceId}`);
    await expect(page.getByTestId("invoice-not-found")).toBeVisible();
    await expect(page.getByText("Facture introuvable")).toBeVisible();
  });

  test("URL directe facture bob INV-2026-002 → 404", async ({ page }) => {
    const bobInvoiceId = "SEED_BOB_INVOICE_ID";
    await page.goto(`/account/invoices/${bobInvoiceId}`);
    await expect(page.getByTestId("invoice-not-found")).toBeVisible();
  });

  test("détail solde TTC correct", async ({ page }) => {
    await page.goto("/account/invoices");
    await page.getByTestId("invoice-link").filter({ hasText: "INV-2026-004" }).click();
    await expect(page.getByTestId("invoice-balance-total-ttc")).toHaveText("480,00 €");
    await expect(page.getByTestId("invoice-balance-paid")).toHaveText("200,00 €");
    await expect(page.getByTestId("invoice-balance-remaining-amount")).toHaveText("280,00 €");
  });
});

test.describe("Customer Invoices — client-bob", () => {
  test.use({ storageState: "e2e/.auth/bob.json" });

  test("voit INV-2026-002, pas factures acme", async ({ page }) => {
    await page.goto("/account/invoices");
    await expect(page.getByText("INV-2026-002")).toBeVisible();
    await expect(page.getByText("INV-2026-004")).not.toBeVisible();
    await expect(page.getByText("INV-2026-001")).not.toBeVisible();
  });
});
