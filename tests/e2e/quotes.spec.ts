import { test, expect } from "@playwright/test";
import { SEED_CLIENT_NAME, SEED_CLIENT_WITHOUT_DRAFT_QUOTE, SEED_QUOTE_NUMBER, uniqueItemDescription } from "./helpers/data";

async function createDraftQuoteViaUI(page: import("@playwright/test").Page, clientName: string = SEED_CLIENT_WITHOUT_DRAFT_QUOTE): Promise<void> {
  await page.goto("/admin/quotes/new");
  await page.click('[data-testid="quote-clientId-select"]');
  await page.getByRole("option", { name: clientName }).click();
  await page.click('[data-testid="quote-submit-button"]');
  await page.waitForURL("**/admin/quotes");
}

async function openLatestQuoteForClient(page: import("@playwright/test").Page, clientName: string): Promise<void> {
  const row = page.getByRole("row", { name: clientName }).first();
  await row.locator('a[data-testid^="quote-edit-"]').click();
  await page.waitForURL(/\/admin\/quotes\//);
}

test.describe("Quotes Admin — E2E", () => {
  test.describe.configure({ timeout: 60_000 });

  test("T1 — liste affiche les devis seed", async ({ page }) => {
    await page.goto("/admin/quotes");
    await expect(page.getByRole("heading", { name: "Devis" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByText(SEED_QUOTE_NUMBER)).toBeVisible();
    await expect(page.getByText("Brouillon").first()).toBeVisible();
    await expect(page.getByText(SEED_CLIENT_NAME).first()).toBeVisible();
    await expect(page.getByText(/2\s?550,00\s?€/).first()).toBeVisible();
  });

  test("T2 — redirect si non-authentifié", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/admin/quotes");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("T3 — créer un devis via formulaire", async ({ page }) => {
    await createDraftQuoteViaUI(page);
    await expect(page.getByRole("row", { name: SEED_CLIENT_WITHOUT_DRAFT_QUOTE }).first()).toBeVisible();
  });

  test("T4 — validation form vide → erreur", async ({ page }) => {
    await page.goto("/admin/quotes/new");
    await page.click('[data-testid="quote-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/quotes\/new/);
    await expect(page.locator('p.text-destructive, [role="alert"]').first()).toBeVisible();
  });

  test("T5 — ajouter un item à un devis brouillon", async ({ page }) => {
    await createDraftQuoteViaUI(page);
    await openLatestQuoteForClient(page, SEED_CLIENT_WITHOUT_DRAFT_QUOTE);

    const desc = uniqueItemDescription();
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.getByRole("button", { name: "Libre" }).click();
    await page.getByLabel("Description").fill(desc);
    await page.getByLabel("Quantité").fill("2");
    await page.getByLabel("Prix unitaire (€)").fill("100.50");
    await page.click('[data-testid="quote-item-submit-button"]');

    await expect(page.getByText(desc)).toBeVisible();
    await expect(page.getByText(/201,00\s?€/).first()).toBeVisible();
  });

  test("T6 — transitions draft→sent→accepted", async ({ page }) => {
    await createDraftQuoteViaUI(page);
    await openLatestQuoteForClient(page, SEED_CLIENT_WITHOUT_DRAFT_QUOTE);

    await page.click('[data-testid="transition-sent-trigger"]');
    await page.click('[data-testid="transition-sent-confirm"]');
    await expect(page.getByText("Envoyé")).toBeVisible();

    await page.goto("/admin/quotes");
    await expect(page.getByRole("row", { name: SEED_CLIENT_WITHOUT_DRAFT_QUOTE }).first().getByText("Envoyé")).toBeVisible();

    await openLatestQuoteForClient(page, SEED_CLIENT_WITHOUT_DRAFT_QUOTE);
    await page.click('[data-testid="transition-accepted-trigger"]');
    await page.click('[data-testid="transition-accepted-confirm"]');
    await expect(page.getByText("Accepté")).toBeVisible();

    await page.goto("/admin/quotes");
    await expect(page.getByRole("row", { name: SEED_CLIENT_WITHOUT_DRAFT_QUOTE }).first().getByText("Accepté")).toBeVisible();
  });
});
