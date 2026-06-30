import { test, expect } from "@playwright/test";
import {
  SEED_CONTACT_PRIMARY_ACME_NAME,
} from "../../lib/test-constants";

const ACME_NAME = "Acme Studio";
const GLOBEX_NAME = "Globex";
const BOB_NAME = "Bob Indep";
const NONE_LABEL = "Aucun (entreprise seule)";

async function selectClient(page: import("@playwright/test").Page, testId: string, clientName: string) {
  await page.locator(`[data-testid="${testId}"]`).click();
  await page.getByRole("option", { name: clientName }).click();
}

test("facture pre-selectionne contact principal", async ({ page }) => {
  await page.goto("/admin/invoices/new");

  await selectClient(page, "invoice-clientId-select", ACME_NAME);

  const contactSelect = page.locator('[data-testid="invoice-contactId-select"]');
  await expect(contactSelect).toBeVisible();
  await expect(contactSelect).toContainText(SEED_CONTACT_PRIMARY_ACME_NAME);
});

test("devis pre-selectionne contact principal", async ({ page }) => {
  await page.goto("/admin/quotes/new");

  await selectClient(page, "quote-clientId-select", ACME_NAME);

  const contactSelect = page.locator('[data-testid="quote-contactId-select"]');
  await expect(contactSelect).toBeVisible();
  await expect(contactSelect).toContainText(SEED_CONTACT_PRIMARY_ACME_NAME);
});

test("facture sans contact principal fallback", async ({ page }) => {
  await page.goto("/admin/invoices/new");

  await selectClient(page, "invoice-clientId-select", BOB_NAME);

  const contactSelect = page.locator('[data-testid="invoice-contactId-select"]');
  await expect(contactSelect).toBeVisible();
  await expect(contactSelect).toContainText(NONE_LABEL);
});

test("changement client re-pre-selectionne", async ({ page }) => {
  await page.goto("/admin/invoices/new");

  await selectClient(page, "invoice-clientId-select", ACME_NAME);

  const contactSelect = page.locator('[data-testid="invoice-contactId-select"]');
  await expect(contactSelect).toBeVisible();
  await expect(contactSelect).toContainText(SEED_CONTACT_PRIMARY_ACME_NAME);

  await selectClient(page, "invoice-clientId-select", GLOBEX_NAME);

  await expect(contactSelect).toContainText("Client Globex");
});
