import { test, expect } from "@playwright/test";
import { uniqueClientName, SEED_CONTRACT_PRICE_FR } from "./helpers/data";
import { createClientViaUI, createContractViaUI, deleteClientByName } from "./helpers/contracts";

test.describe("Contracts Admin — E2E", () => {
  test.describe.configure({ timeout: 60_000 });

  test("T1 — Liste affiche 3 contrats seed", async ({ page }) => {
    await page.goto("/admin/contracts");
    const acmeRow = page.getByRole("row", { name: /Acme Studio/ });
    const bobRow = page.getByRole("row", { name: /Bob Indep/ });
    const globexRow = page.getByRole("row", { name: /Globex/ });
    await expect(acmeRow).toBeVisible();
    await expect(bobRow).toBeVisible();
    await expect(globexRow).toBeVisible();
    await expect(acmeRow).toContainText("Facturation manuelle");
    await expect(acmeRow).toContainText("Actif");
    await expect(acmeRow).toContainText(SEED_CONTRACT_PRICE_FR);
    await expect(bobRow).toContainText("Stripe (auto)");
    await expect(bobRow).toContainText("Actif");
    await expect(globexRow).toContainText("Annulé");
  });

  test("T2 — Filtre statut Annulé", async ({ page }) => {
    await page.goto("/admin/contracts");
    await page.locator('[data-testid="contracts-filter-status"]').click();
    await page.getByRole("option", { name: "Annulé" }).click();
    await expect(page).toHaveURL(/status=canceled/);
    await expect(page.getByRole("row", { name: /Globex/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Acme Studio/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Bob Indep/ })).toHaveCount(0);
  });

  test("T3 — Filtre mode Stripe (auto) + T4 reset", async ({ page }) => {
    await page.goto("/admin/contracts");
    await page.locator('[data-testid="contracts-filter-mode"]').click();
    await page.getByRole("option", { name: "Stripe (auto)" }).click();
    await expect(page).toHaveURL(/billingMode=stripe_auto/);
    await expect(page.getByRole("row", { name: /Bob Indep/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Acme Studio/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Globex/ })).toHaveCount(0);

    await page.locator('[data-testid="contracts-filter-mode"]').click();
    await page.getByRole("option", { name: "Tous" }).click();
    await page.locator('[data-testid="contracts-filter-status"]').click();
    await page.getByRole("option", { name: "Tous" }).click();
    await expect(page.getByRole("row", { name: /Acme Studio/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Bob Indep/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Globex/ })).toBeVisible();
  });

  test("T5 — Page détail Acme (actif)", async ({ page }) => {
    await page.goto("/admin/contracts");
    await page.getByRole("row", { name: /Acme Studio/ }).getByRole("link").click();
    await page.waitForURL(/\/admin\/contracts\/[a-f0-9-]+/);
    await expect(page.locator('[data-testid="contract-client-name"]')).toHaveText("Acme Studio");
    await expect(page.locator('[data-testid="contract-prestation-name"]')).toHaveText("Maintenance mensuelle");
    await expect(page.locator('[data-testid="contract-mode"]')).toContainText("Facturation manuelle");
    await expect(page.locator('[data-testid="contract-status"]')).toContainText("Actif");
    await expect(page.locator('[data-testid="contract-price"]')).toHaveText(SEED_CONTRACT_PRICE_FR);
    await expect(page.locator('[data-testid="contract-period"]')).toHaveText("—");
  });

  test("T6 — Page détail Globex (canceled) — bouton disabled", async ({ page }) => {
    await page.goto("/admin/contracts");
    await page.getByRole("row", { name: /Globex/ }).getByRole("link").click();
    await page.waitForURL(/\/admin\/contracts\/[a-f0-9-]+/);
    await expect(page.locator('[data-testid="contract-cancel-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="contract-cancel-button"]')).toBeDisabled();
  });

  test.describe("T7-T9 — Mutations (auto-created client)", () => {
    let clientName: string;

    test.afterEach(async ({ page }) => {
      try {
        await deleteClientByName(page, clientName);
      } catch {
        // cleanup failure must not mask test failure
      }
    });

    test("T7 — Création contrat", async ({ page }) => {
      clientName = uniqueClientName();
      await createClientViaUI(page, clientName);
      await createContractViaUI(page, { clientName });
      await expect(page.getByRole("row", { name: new RegExp(clientName) })).toBeVisible();
    });

    test("T8 — Doublon contrat (toast erreur)", async ({ page }) => {
      clientName = uniqueClientName();
      await createClientViaUI(page, clientName);
      await createContractViaUI(page, { clientName });

      await page.goto("/admin/contracts/new");
      await page.locator('[data-testid="contract-client-select"]').click();
      await page.getByRole("option", { name: clientName }).click();
      await page.locator('[data-testid="contract-prestation-select"]').click();
      await page.getByRole("option", { name: "Maintenance mensuelle" }).click();
      await page.locator('[data-testid="contract-submit"]').click();
      await expect(page.getByText("Ce client a déjà un contrat de maintenance.")).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/contracts\/new/);
    });

    test("T9 — Cancel contrat", async ({ page }) => {
      clientName = uniqueClientName();
      await createClientViaUI(page, clientName);
      await createContractViaUI(page, { clientName });
      await page.getByRole("row", { name: new RegExp(clientName) }).getByRole("link").click();
      await page.waitForURL(/\/admin\/contracts\/[a-f0-9-]+/);
      await expect(page.locator('[data-testid="contract-cancel-button"]')).toBeEnabled();
      await page.locator('[data-testid="contract-cancel-button"]').click();
      await expect(page.locator('[data-testid="contract-status"]')).toContainText("Annulé");
      await expect(page.locator('[data-testid="contract-cancel-button"]')).toBeDisabled();
    });
  });
});
