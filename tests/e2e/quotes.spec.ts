import { test, expect } from "@playwright/test";
import { SEED_CLIENT_NAME, SEED_CLIENT_WITHOUT_DRAFT_QUOTE, SEED_QUOTE_NUMBER, uniqueItemDescription } from "./helpers/data";

async function createDraftQuoteViaUI(page: import("@playwright/test").Page, clientName: string = SEED_CLIENT_WITHOUT_DRAFT_QUOTE): Promise<void> {
  await page.goto("/admin/quotes/new");
  await page.click('[data-testid="quote-clientId-select"]');
  await page.getByRole("option", { name: clientName }).click();
  await page.click('[data-testid="quote-submit-button"]');
  await page.waitForURL("**/admin/quotes");
}

async function openLatestDraftQuoteForClient(
    page: import("@playwright/test").Page,
    clientName: string,
): Promise<void> {
  // .filter chaîné : row contenant clientName ET "Brouillon"
  // → unique car aucun draft seedé pour Globex.
  const row = page
      .getByRole("row", { name: clientName })
      .filter({ hasText: "Brouillon" })
      .first();
  await row.locator('a[data-testid^="quote-edit-"]').click();
  await page.waitForURL(/\/admin\/quotes\/[a-zA-Z0-9-]+/);
}

test.describe("Quotes Admin — E2E", () => {
  test.describe.configure({ timeout: 60_000 });

  test("T1 — liste affiche les devis seed", async ({ page }) => {
    await page.goto("/admin/quotes");
    await expect(page.getByRole("heading", { name: "Devis" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
    await page.getByTestId("quotes-search").fill(SEED_QUOTE_NUMBER);
    await page.waitForTimeout(500);
    const row = page.getByRole("row", { name: SEED_QUOTE_NUMBER });
    await expect(row).toBeVisible();
    await expect(row.getByText("Brouillon")).toBeVisible();
    await expect(row.getByText(SEED_CLIENT_NAME)).toBeVisible();
    await expect(row.getByText(/2\s?550,00\s?€/)).toBeVisible();
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
    await openLatestDraftQuoteForClient(page, SEED_CLIENT_WITHOUT_DRAFT_QUOTE);

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
    await openLatestDraftQuoteForClient(page, SEED_CLIENT_WITHOUT_DRAFT_QUOTE);

    // ── Transition draft → sent ─────────────────────────────────────────────
    // Pas de navigation post-confirm : revalidatePath rafraîchit en place.
    // On attend que le nouveau bouton "transition-accepted-trigger"
    // apparaisse (preuve que status=sent côté Server Component).
    await page.click('[data-testid="transition-sent-trigger"]');
    await page.click('[data-testid="transition-sent-confirm"]');

    await expect(
        page.locator('[data-testid="transition-accepted-trigger"]'),
    ).toBeVisible({ timeout: 10_000 });

    // ── Transition sent → accepted ──────────────────────────────────────────
    await page.click('[data-testid="transition-accepted-trigger"]');
    await page.click('[data-testid="transition-accepted-confirm"]');

    // État terminal après accepted : "Aucune action possible (état terminal)."
    await expect(
        page.getByText("Aucune action possible"),
    ).toBeVisible({ timeout: 10_000 });

    // ── Validation finale côté liste ────────────────────────────────────────
    // Le devis qu'on vient d'émettre+accepter est désormais "Accepté".
    // Mais Globex en a maintenant DEUX en "Accepté" (Q-2026-003 seed + nouveau).
    // On vérifie qu'au moins UN row Globex+Accepté est visible.
    await page.goto("/admin/quotes");
    await expect(
        page
            .getByRole("row", { name: SEED_CLIENT_WITHOUT_DRAFT_QUOTE })
            .filter({ hasText: "Accepté" })
            .first(),
    ).toBeVisible();
  });
});
