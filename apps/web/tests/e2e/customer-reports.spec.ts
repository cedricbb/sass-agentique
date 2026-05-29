import { test, expect } from "@playwright/test";
import { resolveReportId } from "./helpers/resolve-seed-ids";
import {
  SEED_REPORT_TITLE_ISSUED_ACME_MONTHLY,
  SEED_REPORT_TITLE_DRAFT,
  SEED_REPORT_TITLE_ISSUED_MONTHLY,
} from "@/lib/test-constants";

test.describe("Customer Reports — client-acme", () => {
  test.use({ storageState: "tests/e2e/.auth/acme.json" });

  test("voit le rapport émis Acme dans la liste", async ({ page }) => {
    await page.goto("/account/reports");
    const row = page
      .getByTestId("report-row")
      .filter({ hasText: SEED_REPORT_TITLE_ISSUED_ACME_MONTHLY });
    await expect(row).toBeVisible();
    await expect(row.getByTestId("report-kind-badge")).toHaveText("Mensuel");
  });

  test("ne voit pas le rapport draft", async ({ page }) => {
    await page.goto("/account/reports");
    await expect(page.getByText(SEED_REPORT_TITLE_DRAFT)).not.toBeVisible();
  });

  test("ne voit pas le rapport Bob", async ({ page }) => {
    await page.goto("/account/reports");
    await expect(page.getByText(SEED_REPORT_TITLE_ISSUED_MONTHLY)).not.toBeVisible();
  });

  test("détail rapport émis Acme — read-only", async ({ page }) => {
    await page.goto("/account/reports");
    await page
      .getByTestId("report-link")
      .filter({ hasText: SEED_REPORT_TITLE_ISSUED_ACME_MONTHLY })
      .click();
    await expect(page.getByTestId("report-detail")).toBeVisible();
    await expect(page.getByTestId("report-kind-badge")).toBeVisible();
    await expect(page.getByTestId("report-issued-date")).toBeVisible();
    await expect(page.getByTestId("report-pdf-link")).toBeVisible();
    await expect(page.getByRole("button")).toHaveCount(0);
  });

  test("URL directe draft → 404", async ({ page }) => {
    const draftReportId = await resolveReportId(SEED_REPORT_TITLE_DRAFT);
    const response = await page.goto(`/account/reports/${draftReportId}`);
    expect(response?.status()).toBe(404);
  });

  test("URL directe rapport Bob → 404", async ({ page }) => {
    const bobReportId = await resolveReportId(SEED_REPORT_TITLE_ISSUED_MONTHLY);
    const response = await page.goto(`/account/reports/${bobReportId}`);
    expect(response?.status()).toBe(404);
  });
});

test.describe("Customer Reports — client-bob", () => {
  test.use({ storageState: "tests/e2e/.auth/bob.json" });

  test("bob voit ses rapports pas ceux acme", async ({ page }) => {
    await page.goto("/account/reports");
    await expect(page.getByText(SEED_REPORT_TITLE_ISSUED_MONTHLY)).toBeVisible();
    await expect(page.getByText(SEED_REPORT_TITLE_ISSUED_ACME_MONTHLY)).not.toBeVisible();
    await expect(page.getByText(SEED_REPORT_TITLE_DRAFT)).not.toBeVisible();
  });
});
