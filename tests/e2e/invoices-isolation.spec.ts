import { test, expect } from "@playwright/test";
import { SEED_INVOICE_NUMBER } from "./helpers/data";

test.describe("admin invoices page — owner A", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("admin invoices page owner A shows seed invoice", async ({ page }) => {
    await page.goto("/admin/invoices");
    await expect(page.getByText(SEED_INVOICE_NUMBER)).toBeVisible();
  });
});

test.describe("admin invoices page — owner B", () => {
  test.use({ storageState: "tests/e2e/.auth/owner-b.json" });

  test("admin invoices page owner B hides owner A invoices", async ({ page }) => {
    await page.goto("/admin/invoices");
    await expect(page.getByText(SEED_INVOICE_NUMBER)).not.toBeVisible();
  });

  test("owner B gets 404 on direct owner A invoice URL", async ({ page, browser }) => {
    const ownerAContext = await browser.newContext({
      storageState: "tests/e2e/.auth/user.json",
    });
    const ownerAPage = await ownerAContext.newPage();
    await ownerAPage.goto("/admin/invoices");
    const ownerAInvoiceHref = await ownerAPage
      .getByRole("row", { name: SEED_INVOICE_NUMBER })
      .locator('a[data-testid^="invoice-edit-"]')
      .getAttribute("href");
    await ownerAContext.close();

    expect(ownerAInvoiceHref).toBeTruthy();
    await page.goto(ownerAInvoiceHref!);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText(SEED_INVOICE_NUMBER)).not.toBeVisible();
  });
});
