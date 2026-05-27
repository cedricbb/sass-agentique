import type { Page } from "@playwright/test";

export async function createClientViaUI(page: Page, clientName: string): Promise<void> {
  await page.goto("/admin/clients/new");
  await page.locator('input[name="name"]').fill(clientName);
  const slug = clientName.toLowerCase().replace(/\s+/g, "-");
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator('input[name="email"]').fill(`${clientName.replace(/\s/g, "")}@e2e.test`);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/admin/clients");
}

export async function createContractViaUI(
  page: Page,
  opts: { clientName: string; prestationName?: string; billingMode?: string; price?: string },
): Promise<void> {
  await page.goto("/admin/contracts/new");
  await page.locator('[data-testid="contract-client-select"]').click();
  await page.getByRole("option", { name: opts.clientName }).click();
  await page.locator('[data-testid="contract-prestation-select"]').click();
  await page.getByRole("option", { name: opts.prestationName ?? "Maintenance mensuelle" }).click();
  if (opts.billingMode) {
    await page.locator('[data-testid="contract-billing-mode-select"]').click();
    await page.getByRole("option", { name: opts.billingMode }).click();
  }
  if (opts.price) {
    await page.locator('[data-testid="contract-monthly-price-input"]').fill(opts.price);
  }
  await Promise.all([
    page.waitForURL("**/admin/contracts"),
    page.locator('[data-testid="contract-submit"]').click(),
  ]);
}

export async function deleteClientByName(page: Page, clientName: string): Promise<void> {
  await page.goto("/admin/clients");
  await page.locator('[data-testid="clients-search"]').fill(clientName);
  await page.waitForTimeout(500);
  await page.getByRole("row", { name: new RegExp(clientName) }).getByRole("link").click();
  await page.waitForURL(/\/admin\/clients\/[a-f0-9-]+/);
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("button", { name: "Confirmer" }).click();
  await page.waitForURL("**/admin/clients");
}
