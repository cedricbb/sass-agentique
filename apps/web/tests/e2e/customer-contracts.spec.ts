import { test, expect } from "@playwright/test";
import { resolveContractIdByClientAndStatus } from "./helpers/resolve-seed-ids";
import {
  SEED_CONTRACT_PRESTATION_NAME_ACME,
  SEED_CONTRACT_PRESTATION_NAME_GLOBEX_CANCELED,
} from "@/lib/test-constants";

test.describe("Customer Contracts — client-acme", () => {
  test.use({ storageState: "tests/e2e/.auth/acme.json" });

  test("t1_acme_liste_detail_nominal", async ({ page }) => {
    await page.goto("/account/contracts");
    const row = page
      .getByTestId("contract-row")
      .filter({ hasText: SEED_CONTRACT_PRESTATION_NAME_ACME });
    await expect(row).toBeVisible();
    await row.getByTestId("contract-link").click();
    await expect(page.getByTestId("contract-detail-title")).toHaveText(
      SEED_CONTRACT_PRESTATION_NAME_ACME,
    );
    await expect(page.getByTestId("contract-detail-status")).toHaveText("Actif");
    await expect(page.getByTestId("contract-billed-amount")).toHaveText(/\d+,\d{2}.*HT/);
  });

  test("t3_404_uuid_inexistant", async ({ page }) => {
    const response = await page.goto(`/account/contracts/${crypto.randomUUID()}`);
    expect(response?.status()).toBe(404);
  });

  test("t4_404_non_uuid", async ({ page }) => {
    const response = await page.goto("/account/contracts/not-a-uuid");
    expect(response?.status()).toBe(404);
  });

  test("t5_404_cross_client_uuid_bob", async ({ page }) => {
    const bobContractId = await resolveContractIdByClientAndStatus("bob", "active");
    const response = await page.goto(`/account/contracts/${bobContractId}`);
    expect(response?.status()).toBe(404);
  });

  test("t7_sidebar_6_items_mes_contrats", async ({ page }) => {
    await page.goto("/account/contracts");
    await expect(page.locator("aside nav a")).toHaveCount(6);
    await expect(page.getByText("Mes contrats")).toBeVisible();
  });
});

test.describe("Customer Contracts — client-globex", () => {
  test.use({ storageState: "tests/e2e/.auth/globex.json" });

  test("t2_globex_canceled_visible", async ({ page }) => {
    await page.goto("/account/contracts");
    const row = page.getByTestId("contract-row");
    await expect(row).toBeVisible();
    await expect(row.getByTestId("contract-status-badge")).toHaveText("Résilié");
  });

  test("t6_globex_detail_canceled", async ({ page }) => {
    const contractId = await resolveContractIdByClientAndStatus("globex", "canceled");
    await page.goto(`/account/contracts/${contractId}`);
    await expect(page.getByTestId("contract-detail-title")).toHaveText(
      SEED_CONTRACT_PRESTATION_NAME_GLOBEX_CANCELED,
    );
    await expect(page.getByTestId("contract-detail-status")).toHaveText("Résilié");
  });
});
