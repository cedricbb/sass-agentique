import { test, expect } from "@playwright/test";
import { resolveInvoiceId } from "./helpers/resolve-seed-ids";

test.use({ storageState: "tests/e2e/.auth/owner-b.json" });

test("owner_b_cannot_download_owner_a_invoice_pdf_404", async ({ page }) => {
  const ownerAInvoiceId = await resolveInvoiceId("INV-2026-001");

  const response = await page.request.get(
    `/api/invoices/${ownerAInvoiceId}/file`,
  );

  expect(response.status()).toBe(404);
});
