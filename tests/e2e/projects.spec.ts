import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";
import { uniqueProjectName, SEED_CLIENT_NAME } from "./helpers/data";

async function createProjectViaUI(page: import("@playwright/test").Page, projectName: string): Promise<void> {
  await page.goto("/admin/projects/new");
  await page.click('[data-testid="project-client-select"]');
  await page.getByText(SEED_CLIENT_NAME, { exact: true }).click();
  await page.fill('[data-testid="project-name-input"]', projectName);
  await page.fill('[data-testid="project-slug-input"]', projectName.toLowerCase().replace(/\s+/g, "-"));
  await page.click('[data-testid="project-form-submit"]');
  await page.waitForURL("**/admin/projects");
}

async function searchProject(page: import("@playwright/test").Page, projectName: string): Promise<void> {
  await page.fill('[data-testid="projects-search"]', projectName);
}

test.describe("Projects Admin — E2E", () => {
  test("liste affiche les projets seed avec badges", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/projects");

    await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();
    await expect(page.getByText("Actif")).toBeVisible();
  });

  test("redirect vers /login si non-authentifié", async ({ page }) => {
    await page.goto("/admin/projects");

    await expect(page).toHaveURL(/\/login/);
  });

  test("créer un projet via formulaire", async ({ page }) => {
    await loginAsAdmin(page);
    const projectName = uniqueProjectName();

    await createProjectViaUI(page, projectName);

    await searchProject(page, projectName);
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test("validation form vide affiche erreur", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/projects/new");

    await page.click('[data-testid="project-form-submit"]');

    await expect(page).toHaveURL(/\/admin\/projects\/new/);
    await expect(page.locator("p.text-destructive, [role='alert']").first()).toBeVisible();
  });

  test("éditer un projet et vérifier en liste", async ({ page }) => {
    await loginAsAdmin(page);
    const originalName = uniqueProjectName();
    await createProjectViaUI(page, originalName);

    await searchProject(page, originalName);
    const editLink = page.locator(`a[data-testid^="project-edit-"]`).first();
    await editLink.click();

    const updatedName = uniqueProjectName();
    await page.fill('[data-testid="project-name-input"]', updatedName);
    await page.click('[data-testid="project-form-submit"]');
    await page.waitForURL("**/admin/projects");

    await searchProject(page, updatedName);
    await expect(page.getByText(updatedName)).toBeVisible();
  });

  test("transition draft → active sans confirm", async ({ page }) => {
    await loginAsAdmin(page);
    const projectName = uniqueProjectName();
    await createProjectViaUI(page, projectName);

    await searchProject(page, projectName);
    const editLink = page.locator(`a[data-testid^="project-edit-"]`).first();
    await editLink.click();

    await page.click('[data-testid="transition-active-trigger"]');
    await page.waitForURL("**/admin/projects");

    await searchProject(page, projectName);
    await expect(page.getByText("Actif")).toBeVisible();
  });

  test("transition active → delivered avec AlertDialog + badge Livré vert", async ({ page }) => {
    await loginAsAdmin(page);
    const projectName = uniqueProjectName();
    await createProjectViaUI(page, projectName);

    await searchProject(page, projectName);
    const editLink = page.locator(`a[data-testid^="project-edit-"]`).first();
    await editLink.click();

    await page.click('[data-testid="transition-active-trigger"]');
    await page.waitForURL("**/admin/projects");

    await searchProject(page, projectName);
    await page.locator(`a[data-testid^="project-edit-"]`).first().click();

    await page.click('[data-testid="transition-delivered-trigger"]');
    await page.getByTestId("transition-delivered-confirm").click();
    await page.waitForURL("**/admin/projects");

    await searchProject(page, projectName);
    await expect(page.getByText("Livré")).toBeVisible();
    await expect(page.locator('[data-variant="success"]')).toBeVisible();
  });
});
