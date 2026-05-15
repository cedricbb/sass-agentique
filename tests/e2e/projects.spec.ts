import { test, expect } from "@playwright/test";
import { uniqueProjectName, SEED_CLIENT_NAME } from "./helpers/data";

async function createProjectViaUI(page: import("@playwright/test").Page, projectName: string): Promise<void> {
  await page.goto("/admin/projects/new");
  await page.click('[data-testid="project-client-select"]');
  await page.getByRole("option", { name: SEED_CLIENT_NAME }).click();
  await page.fill('[data-testid="project-name-input"]', projectName);
  await page.fill('[data-testid="project-slug-input"]', projectName.toLowerCase().replace(/\s+/g, "-"));
  await page.click('[data-testid="project-form-submit"]');
  await page.waitForURL("**/admin/projects");
}

async function searchProject(page: import("@playwright/test").Page, projectName: string): Promise<void> {
  await page.fill('[data-testid="projects-search"]', projectName);
  // Attendre un peu que le filtrage (côté client dans ProjectsTable) s'applique
  await page.waitForTimeout(500);
}

test.describe("Projects Admin — E2E", () => {
  test.describe.configure({ timeout: 60_000 });
  test("liste affiche les projets seed avec badges", async ({ page }) => {
    await page.goto("/admin/projects");

    await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();
    
    // Attendre que la table soit chargée et que l'un des statuts seed soit visible
    // On s'attend à voir au moins un badge "Brouillon", "Livré", "En pause" ou "Annulé" d'après le debug
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText(/Brouillon|Livré|En pause|Annulé/i).first()).toBeVisible();
  });

  test("redirect vers /login si non-authentifié", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/admin/projects");

    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("créer un projet via formulaire", async ({ page }) => {
    const projectName = uniqueProjectName();

    await createProjectViaUI(page, projectName);

    await searchProject(page, projectName);
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test("validation form vide affiche erreur", async ({ page }) => {
    await page.goto("/admin/projects/new");

    await page.click('[data-testid="project-form-submit"]');

    await expect(page).toHaveURL(/\/admin\/projects\/new/);
    await expect(page.locator("p.text-destructive, [role='alert']").first()).toBeVisible();
  });

  test("éditer un projet et vérifier en liste", async ({ page }) => {
    const originalName = uniqueProjectName();
    await createProjectViaUI(page, originalName);

    await searchProject(page, originalName);
    const row = page.getByRole("row", { name: originalName });
    await row.locator('a[data-testid^="project-edit-"]').click();
    await page.waitForURL(/\/admin\/projects\/[a-zA-Z0-9-]+/);

    const updatedName = uniqueProjectName();
    await page.fill('[data-testid="project-name-input"]', updatedName);
    await page.click('[data-testid="project-form-submit"]');
    await page.waitForURL("**/admin/projects");

    await searchProject(page, updatedName);
    await expect(page.getByRole("row", { name: updatedName }).getByText(updatedName)).toBeVisible();
  });

  test("transition draft → active sans confirm", async ({ page }) => {
    const projectName = uniqueProjectName();
    await createProjectViaUI(page, projectName);

    await searchProject(page, projectName);
    const row = page.getByRole("row", { name: projectName });
    await row.locator('a[data-testid^="project-edit-"]').click();
    await page.waitForURL(/\/admin\/projects\/[a-zA-Z0-9-]+/);

    await page.click('[data-testid="transition-active-trigger"]');
    await page.waitForURL("**/admin/projects");

    await searchProject(page, projectName);
    await expect(page.getByRole("row", { name: projectName }).getByText(/Actif/i)).toBeVisible();
  });

  test("transition active → delivered avec AlertDialog + badge Livré vert", async ({ page }) => {
    const projectName = uniqueProjectName();
    await createProjectViaUI(page, projectName);

    await searchProject(page, projectName);
    const rowBeforeActive = page.getByRole("row", { name: projectName });
    await rowBeforeActive.locator('a[data-testid^="project-edit-"]').click();
    await page.waitForURL(/\/admin\/projects\/[a-zA-Z0-9-]+/);

    await page.click('[data-testid="transition-active-trigger"]');
    await page.waitForURL("**/admin/projects");

    await searchProject(page, projectName);
    const rowBeforeDelivered = page.getByRole("row", { name: projectName });
    await rowBeforeDelivered.locator('a[data-testid^="project-edit-"]').click();
    await page.waitForURL(/\/admin\/projects\/[a-zA-Z0-9-]+/);

    await page.click('[data-testid="transition-delivered-trigger"]');
    await page.getByTestId("transition-delivered-confirm").click();
    await page.waitForURL("**/admin/projects");

    await searchProject(page, projectName);
    await expect(page.getByRole("row", { name: projectName }).getByText(/Livré/i)).toBeVisible();
    await expect(page.getByRole("row", { name: projectName }).locator('[data-variant="success"]')).toBeVisible();
  });
});
