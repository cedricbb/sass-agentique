import { test, expect } from "@playwright/test";
import {
  SEED_PAYMENT_COUNT,
  SEED_PAYMENT_BANK_TRANSFER_REF,
  SEED_INVOICE_SENT_NUMBER,
  SEED_INVOICE_PAID_NUMBER,
  SEED_CLIENT_NAME,
  uniqueItemDescription,
} from "./helpers/data";

async function navigateToInvoice(
  page: import("@playwright/test").Page,
  invoiceNumber: string,
): Promise<void> {
  await page.goto("/admin/invoices");
  await page.getByTestId("invoices-search").fill(invoiceNumber);
  const row = page.getByRole("row", { name: invoiceNumber });
  await expect(row).toBeVisible();
  await row.locator("a").first().click();
  await expect(page).toHaveURL(/\/admin\/invoices\/[a-zA-Z0-9-]+/);
}

test.describe("Payments Admin — E2E", () => {
  test.describe.configure({ timeout: 60_000 });

  test("T1 — liste globale /admin/payments", async ({ page }) => {
    await page.goto("/admin/payments");
    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(SEED_PAYMENT_COUNT);
  });

  test("T2 — filtre méthode Virement", async ({ page }) => {
    await page.goto("/admin/payments");
    await page.getByTestId("payments-method-filter").click();
    await page.getByRole("option", { name: "Virement" }).click();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);

    await page.getByTestId("payments-method-filter").click();
    await page.getByRole("option", { name: "Toutes" }).click();
    await expect(rows).toHaveCount(SEED_PAYMENT_COUNT);
  });

  test("T3 — recherche par référence externe", async ({ page }) => {
    await page.goto("/admin/payments");
    await page.getByTestId("payments-search").fill(SEED_PAYMENT_BANK_TRANSFER_REF);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("T4 — lien retour vers invoice depuis liste", async ({ page }) => {
    await page.goto("/admin/payments");
    await page.getByTestId("payments-search").fill("pi_seed_002");
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    const viewLink = rows.first().locator("[data-testid^='payment-view-']");
    await viewLink.click();
    await expect(page).toHaveURL(/\/admin\/invoices\/[a-zA-Z0-9-]+/);
    await expect(page.getByRole("heading", { name: SEED_INVOICE_SENT_NUMBER })).toBeVisible();
  });

  test("T8 — lecture seule sur invoice paid", async ({ page }) => {
    await navigateToInvoice(page, SEED_INVOICE_PAID_NUMBER);
    await expect(page.getByTestId("invoice-payments-list")).toBeVisible();
    await expect(page.getByTestId("record-payment-button")).toBeHidden();
    await expect(page.locator("[data-testid^='invoice-payment-delete-trigger-']")).toHaveCount(0);
  });

  test("T9 — état vide aucun paiement", async ({ page }) => {
    await page.goto("/admin/invoices/new");
    await page.click('[data-testid="invoice-clientId-select"]');
    await page.getByRole("option", { name: SEED_CLIENT_NAME }).click();
    await page.click('[data-testid="invoice-submit"]');
    await expect(page).toHaveURL(/\/admin\/invoices$/);

    const draftRow = page
      .getByRole("row", { name: SEED_CLIENT_NAME })
      .filter({ hasText: "Brouillon" })
      .first();
    await draftRow.locator("a").first().click();
    await expect(page).toHaveURL(/\/admin\/invoices\/[a-zA-Z0-9-]+/);

    const desc = uniqueItemDescription();
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.getByRole("button", { name: "Libre" }).click();
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Quantité").fill("1");
    await page.getByLabel("Prix unitaire (€)").fill("10");
    await page.click('[data-testid="invoice-item-submit-button"]');
    await expect(page.getByText(desc)).toBeVisible();

    await page.click('[data-testid="invoice-transition-sent-trigger"]');
    await page.click('[data-testid="invoice-transition-sent-confirm"]');

    await expect(page.getByTestId("invoice-payments-list")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("invoice-payments-empty")).toBeVisible();
    await expect(page.getByTestId("invoice-payments-empty")).toHaveText("Aucun paiement enregistré");
  });

  test.describe.serial("Mutations sur INV-2026-002", () => {
    test("T7 — suppression d'un paiement", async ({ page }) => {
      await navigateToInvoice(page, SEED_INVOICE_SENT_NUMBER);
      await expect(page.getByTestId("invoice-payments-list")).toBeVisible();

      const paymentItems = page.locator("[data-testid^='invoice-payment-item-']");
      const initialCount = await paymentItems.count();
      const firstItem = paymentItems.first();
      const itemTestId = await firstItem.getAttribute("data-testid");
      const paymentId = itemTestId!.replace("invoice-payment-item-", "");

      await page.getByTestId(`invoice-payment-delete-trigger-${paymentId}`).click();
      await page.getByTestId(`invoice-payment-delete-confirm-${paymentId}`).click();

      await expect(paymentItems).toHaveCount(initialCount - 1);
      await expect(page.getByTestId("invoice-balance-remaining")).toBeVisible();
    });

    test("T5 — création paiement partiel", async ({ page }) => {
      await navigateToInvoice(page, SEED_INVOICE_SENT_NUMBER);

      await page.getByTestId("record-payment-button").click();
      await expect(page.getByTestId("record-payment-dialog")).toBeVisible();

      await page.getByTestId("record-payment-amount-input").fill("50");
      await page.getByTestId("record-payment-method-trigger").click();
      await page.getByRole("option", { name: "Virement" }).click();
      await page.getByTestId("record-payment-submit").click();

      await expect(page.getByTestId("record-payment-dialog")).toBeHidden({ timeout: 10_000 });
      await expect(page.getByTestId("invoice-balance-badge")).toHaveText(/Reste à payer/);
    });

    test("T6 — solde exact déclenche auto-paid", async ({ page }) => {
      await navigateToInvoice(page, SEED_INVOICE_SENT_NUMBER);

      const remainingText = await page.getByTestId("invoice-balance-remaining-amount").textContent();
      const remainingMatch = remainingText!.match(/([\d\s]+[,.][\d]+)/);
      const remainingValue = remainingMatch
        ? remainingMatch[1].replace(/\s/g, "").replace(",", ".")
        : "0";

      await page.getByTestId("record-payment-button").click();
      await expect(page.getByTestId("record-payment-dialog")).toBeVisible();

      await page.getByTestId("record-payment-amount-input").fill(remainingValue);
      await page.getByTestId("record-payment-method-trigger").click();
      await page.getByRole("option", { name: "Virement" }).click();
      await page.getByTestId("record-payment-submit").click();

      await expect(page.getByTestId("record-payment-dialog")).toBeHidden({ timeout: 10_000 });
      await expect(page.getByTestId("invoice-balance-badge")).toHaveText(/Payée/, { timeout: 10_000 });
      await expect(page.getByTestId("record-payment-button")).toBeHidden({ timeout: 5_000 });
    });
  });
});
