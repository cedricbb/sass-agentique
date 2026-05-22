import { test, expect } from "@playwright/test";
import {
  SEED_REPORT_TITLE_DRAFT,
  SEED_REPORT_TITLE_ISSUED_MONTHLY,
  SEED_REPORT_TITLE_ISSUED_AUDIT,
  UPLOAD_REPORT_FIXTURE_PATH,
  SEED_CLIENT_NAME,
  uniqueReportTitle,
} from "./helpers/data";

async function getReportRow(page: import("@playwright/test").Page, title: string) {
  return page.getByRole("row", { name: title });
}

async function createReportViaUI(
  page: import("@playwright/test").Page,
  opts: { title: string; client?: string; kind?: string },
): Promise<void> {
  await page.goto("/admin/reports/new");
  await page
    .locator('[data-testid="report-file-input"]')
    .setInputFiles(UPLOAD_REPORT_FIXTURE_PATH);
  await page.locator('[data-testid="report-client-select"]').click();
  await page
    .getByRole("option", { name: opts.client ?? SEED_CLIENT_NAME })
    .click();
  await page
    .locator('[data-testid="report-title-input"]')
    .fill(opts.title);
  if (opts.kind) {
    await page.locator('[data-testid="report-kind-select"]').click();
    await page.getByRole("option", { name: opts.kind }).click();
  }
  await Promise.all([
    page.waitForURL(/\/admin\/reports\/[a-f0-9-]+/),
    page.locator('[data-testid="report-form-submit"]').click(),
  ]);
}

test.describe("Reports Admin — E2E", () => {
  test.describe.configure({ mode: "serial", timeout: 60_000 });

  test("T1 — liste affiche les 3 reports seed", async ({ page }) => {
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
    await expect(await getReportRow(page, SEED_REPORT_TITLE_DRAFT)).toBeVisible();
    await expect(await getReportRow(page, SEED_REPORT_TITLE_ISSUED_MONTHLY)).toBeVisible();
    await expect(await getReportRow(page, SEED_REPORT_TITLE_ISSUED_AUDIT)).toBeVisible();
  });

  test("T2 — filtre kind=Audit", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.locator('[data-testid="reports-filter-kind"]').click();
    await page.getByRole("option", { name: "Audit" }).click();

    const auditRow = await getReportRow(page, SEED_REPORT_TITLE_ISSUED_AUDIT);
    await expect(auditRow).toBeVisible();

    const draftRow = await getReportRow(page, SEED_REPORT_TITLE_DRAFT);
    await expect(draftRow).toBeHidden();
  });

  test("T3 — filtre status=Brouillon", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.locator('[data-testid="reports-filter-status"]').click();
    await page.getByRole("option", { name: "Brouillon" }).click();

    const draftRow = await getReportRow(page, SEED_REPORT_TITLE_DRAFT);
    await expect(draftRow).toBeVisible();

    const monthlyRow = await getReportRow(page, SEED_REPORT_TITLE_ISSUED_MONTHLY);
    await expect(monthlyRow).toBeHidden();
  });

  test("T4 — recherche audit", async ({ page }) => {
    await page.goto("/admin/reports");
    await page.locator('[data-testid="reports-search"]').fill("audit");

    const auditRow = await getReportRow(page, SEED_REPORT_TITLE_ISSUED_AUDIT);
    await expect(auditRow).toBeVisible();

    const draftRow = await getReportRow(page, SEED_REPORT_TITLE_DRAFT);
    await expect(draftRow).toBeHidden();
  });

  test("T5 — création report", async ({ page }) => {
    const title = uniqueReportTitle();
    await createReportViaUI(page, { title });

    await expect(page).toHaveURL(/\/admin\/reports\/[a-f0-9-]+/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator('[data-testid="report-pdf-viewer"]')).toBeVisible();

    await page.goto("/admin/reports");
    const createdRow = await getReportRow(page, title);
    await expect(createdRow).toBeVisible();
  });

  test("T6 — mark-issued draft Acme", async ({ page }) => {
    await page.goto("/admin/reports");
    const draftRow = await getReportRow(page, SEED_REPORT_TITLE_DRAFT);
    await draftRow.locator("[data-testid^='report-view-']").click();
    await expect(page).toHaveURL(/\/admin\/reports\/[a-f0-9-]+/);

    await expect(page.getByTestId("report-status-badge")).toHaveText("Brouillon");
    await page.locator('[data-testid="report-mark-issued-button"]').click();
    await expect(page.getByTestId("report-status-badge")).toHaveText("Émis");
    await expect(page.locator('[data-testid="report-mark-issued-button"]')).toBeHidden();
  });

  test("T7 — delete draft propre", async ({ page }) => {
    const title = uniqueReportTitle();
    await createReportViaUI(page, { title });

    await expect(page).toHaveURL(/\/admin\/reports\/[a-f0-9-]+/);
    await page.locator('[data-testid="report-delete-trigger"]').click();
    await page.locator('[data-testid="report-delete-confirm"]').click();

    await expect(page).toHaveURL(/\/admin\/reports$/);
    const deletedRow = await getReportRow(page, title);
    await expect(deletedRow).toBeHidden();
  });

  test("T8 — delete bloqué issued", async ({ page }) => {
    await page.goto("/admin/reports");
    const issuedRow = await getReportRow(page, SEED_REPORT_TITLE_ISSUED_MONTHLY);
    await issuedRow.locator("[data-testid^='report-view-']").click();
    await expect(page).toHaveURL(/\/admin\/reports\/[a-f0-9-]+/);

    const deleteButton = page.locator('[data-testid="report-delete-trigger"]');
    await expect(deleteButton).toBeDisabled();

    await deleteButton.hover();
    await expect(
      page.getByText("Un rapport émis ne peut pas être supprimé."),
    ).toBeVisible({ timeout: 5_000 });
  });
});
