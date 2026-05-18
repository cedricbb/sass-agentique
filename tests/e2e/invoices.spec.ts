import { test, expect } from "@playwright/test";
import {
  SEED_INVOICE_NUMBER,
  SEED_INVOICE_TTC_FR,
  SEED_INVOICE_CLIENT_NAME,
  SEED_CLIENT_NAME,
  SEED_CLIENT_WITHOUT_DRAFT_QUOTE,
  uniqueItemDescription,
} from "./helpers/data";

async function createDraftInvoiceViaUI(
  page: import("@playwright/test").Page,
  clientName: string = SEED_CLIENT_NAME,
): Promise<void> {
  await page.goto("/admin/invoices/new");
  await page.click('[data-testid="invoice-clientId-select"]');
  await page.getByRole("option", { name: clientName }).click();
  await page.click('[data-testid="invoice-submit"]');
  await page.waitForURL("**/admin/invoices");
}

async function openLatestDraftInvoiceForClient(
  page: import("@playwright/test").Page,
  clientName: string,
): Promise<void> {
  const row = page
    .getByRole("row", { name: clientName })
    .filter({ hasText: "Brouillon" })
    .first();
  await row.locator('a[data-testid^="invoice-edit-"]').click();
  await page.waitForURL(/\/admin\/invoices\/[a-zA-Z0-9-]+/);
}

test.describe("Invoices Admin — E2E", () => {
  test.describe.configure({ timeout: 60_000 });

  test("T1 — liste affiche les factures seed", async ({ page }) => {
    await page.goto("/admin/invoices");
    await expect(page.getByRole("heading", { name: "Factures" })).toBeVisible();
    await page.getByTestId("invoices-search").fill(SEED_INVOICE_NUMBER);
    await page.waitForTimeout(500);
    const row = page.getByRole("row", { name: SEED_INVOICE_NUMBER });
    await expect(row).toBeVisible();
    await expect(row.getByText("Brouillon")).toBeVisible();
    await expect(row.getByText(SEED_INVOICE_CLIENT_NAME)).toBeVisible();
    await expect(row.getByText(/300,00\s?€/)).toBeVisible();
  });

  test("T2 — redirect si non-authentifié", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const unauthPage = await context.newPage();
    await unauthPage.goto("/admin/invoices");
    await expect(unauthPage).toHaveURL(/\/login/);
    await context.close();
  });

  test("T3 — créer une facture vierge via formulaire", async ({ page }) => {
    await createDraftInvoiceViaUI(page);
    await expect(
      page
        .getByRole("row", { name: SEED_CLIENT_NAME })
        .filter({ hasText: "Brouillon" })
        .first(),
    ).toBeVisible();
  });

  test("T4 — ajouter un item à une facture brouillon", async ({ page }) => {
    await createDraftInvoiceViaUI(page);
    await openLatestDraftInvoiceForClient(page, SEED_CLIENT_NAME);

    const desc = uniqueItemDescription();
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.getByRole("button", { name: "Libre" }).click();
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Quantité").fill("2");
    await page.getByLabel("Prix unitaire (€)").fill("100.50");
    await page.click('[data-testid="invoice-item-submit-button"]');

    await expect(page.getByText(desc)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: desc }).getByText(/201,00\s?€/)).toBeVisible();
  });

  test("T5 — transitions draft→sent→paid", async ({ page }) => {
    await createDraftInvoiceViaUI(page);
    await openLatestDraftInvoiceForClient(page, SEED_CLIENT_NAME);

    await page.click('[data-testid="invoice-transition-sent-trigger"]');
    await page.click('[data-testid="invoice-transition-sent-confirm"]');

    await expect(
      page.locator('[data-testid="invoice-transition-paid-trigger"]'),
    ).toBeVisible({ timeout: 10_000 });

    await page.click('[data-testid="invoice-transition-paid-trigger"]');
    await page.click('[data-testid="invoice-transition-paid-confirm"]');

    await expect(
      page.getByText("Aucune action possible"),
    ).toBeVisible({ timeout: 10_000 });

    await page.goto("/admin/invoices");
    await expect(
      page
        .getByRole("row", { name: SEED_CLIENT_NAME })
        .filter({ hasText: "Payée" })
        .first(),
    ).toBeVisible();
  });

  test("T6 — créer une facture depuis un devis accepté (cross-flow)", async ({ page }) => {
    await page.goto("/admin/quotes/new");
    await page.click('[data-testid="quote-clientId-select"]');
    await page.getByRole("option", { name: SEED_CLIENT_NAME }).click();
    await page.click('[data-testid="quote-submit-button"]');
    await page.waitForURL("**/admin/quotes");

    const row = page
      .getByRole("row", { name: SEED_CLIENT_NAME })
      .filter({ hasText: "Brouillon" })
      .first();
    await row.locator('a[data-testid^="quote-edit-"]').click();
    await page.waitForURL(/\/admin\/quotes\/[a-zA-Z0-9-]+/);

    const desc = uniqueItemDescription();
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.getByRole("button", { name: "Libre" }).click();
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Quantité").fill("1");
    await page.getByLabel("Prix unitaire (€)").fill("100");
    await page.click('[data-testid="quote-item-submit-button"]');
    await expect(page.getByText(desc)).toBeVisible();

    await page.click('[data-testid="transition-sent-trigger"]');
    await page.click('[data-testid="transition-sent-confirm"]');
    await expect(
      page.locator('[data-testid="transition-accepted-trigger"]'),
    ).toBeVisible({ timeout: 10_000 });

    await page.click('[data-testid="transition-accepted-trigger"]');
    await page.click('[data-testid="transition-accepted-confirm"]');

    await expect(
      page.getByTestId("quote-to-invoice-button"),
    ).toBeVisible({ timeout: 10_000 });

    await page.click('[data-testid="quote-to-invoice-button"]');
    await page.click('[data-testid="quote-to-invoice-confirm"]');

    await page.waitForURL(/\/admin\/invoices\/[a-zA-Z0-9-]+/);
    await expect(page.getByText(desc)).toBeVisible();
  });
});
