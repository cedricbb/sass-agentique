import { test, expect } from "@playwright/test";
import { resolveQuoteId } from "./helpers/resolve-seed-ids";

test.describe("Customer Quotes — client-acme", () => {
  test.use({ storageState: "tests/e2e/.auth/acme.json" });

  test("voit Q-2026-004 dans la liste", async ({ page }) => {
    await page.goto("/account/quotes");
    const row = page.getByTestId("quote-row").filter({ hasText: "Q-2026-004" });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("quote-status-badge")).toHaveText("Refusé");
  });

  test("ne voit pas Q-2026-001 (draft)", async ({ page }) => {
    await page.goto("/account/quotes");
    await expect(page.getByText("Q-2026-001")).not.toBeVisible();
  });

  test("ne voit pas Q-2026-005 (bob)", async ({ page }) => {
    await page.goto("/account/quotes");
    await expect(page.getByText("Q-2026-005")).not.toBeVisible();
  });

  test("détail Q-2026-004 → 200 read-only", async ({ page }) => {
    await page.goto("/account/quotes");
    await page.getByTestId("quote-link").filter({ hasText: "Q-2026-004" }).click();
    await expect(page.getByTestId("quote-detail")).toBeVisible();
    await expect(page.getByTestId("quote-amounts-card")).toBeVisible();
    await expect(page.getByTestId("quote-amount-ht")).toBeVisible();
    await expect(page.getByTestId("quote-amount-vat")).toBeVisible();
    await expect(page.getByTestId("quote-amount-ttc")).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
  });

  test("URL directe draft Q-2026-001 → 404", async ({ page }) => {
    const draftQuoteId = await resolveQuoteId("Q-2026-001");
    await page.goto(`/account/quotes/${draftQuoteId}`);
    await expect(page.getByTestId("quote-not-found")).toBeVisible();
    await expect(page.getByText("Devis introuvable")).toBeVisible();
  });

  test("URL directe devis bob → 404", async ({ page }) => {
    const bobQuoteId = await resolveQuoteId("Q-2026-005");
    await page.goto(`/account/quotes/${bobQuoteId}`);
    await expect(page.getByTestId("quote-not-found")).toBeVisible();
  });
});

test.describe("Customer Quotes — client-bob", () => {
  test.use({ storageState: "tests/e2e/.auth/bob.json" });

  test("voit Q-2026-005, pas devis acme", async ({ page }) => {
    await page.goto("/account/quotes");
    await expect(page.getByText("Q-2026-005")).toBeVisible();
    await expect(page.getByText("Q-2026-004")).not.toBeVisible();
    await expect(page.getByText("Q-2026-002")).not.toBeVisible();
  });
});
