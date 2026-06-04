import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@saas.dev";
const ORIGINAL_PWD = "admin1234";
const TEMP_PWD = "TempPwd-e2e-9876";

async function openPasswordDialog(page: Page): Promise<void> {
  await page.goto("/admin/profile");
  await page.getByRole("button", { name: "Modifier le mot de passe" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function submitPasswordForm(
  page: Page,
  old: string,
  newPwd: string,
  confirm: string,
): Promise<void> {
  await page.fill("input#oldPassword", old);
  await page.fill("input#newPassword", newPwd);
  await page.fill("input#confirmNewPassword", confirm);
  await page.getByRole("dialog").getByRole("button", { name: "Modifier" }).click();
}

async function resetPasswordViaDialog(page: Page, fromPwd: string, toPwd: string): Promise<void> {
  await openPasswordDialog(page);
  await submitPasswordForm(page, fromPwd, toPwd, toPwd);
  await expect(page.getByText("Mot de passe modifié")).toBeVisible();
}

async function loginWithCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);
}

test("T1_change_password_success_and_relogin", async ({ page }) => {
  try {
    await openPasswordDialog(page);
    await submitPasswordForm(page, ORIGINAL_PWD, TEMP_PWD, TEMP_PWD);
    await expect(page.getByText("Mot de passe modifié")).toBeVisible();

    await page.context().clearCookies();
    await loginWithCredentials(page, ADMIN_EMAIL, TEMP_PWD);
    await expect(page).toHaveURL(/\/admin/);
  } finally {
    await resetPasswordViaDialog(page, TEMP_PWD, ORIGINAL_PWD);
  }
});

test("T2_wrong_old_password_shows_error", async ({ page }) => {
  await openPasswordDialog(page);
  await submitPasswordForm(page, "wrongpassword", "NewValid99", "NewValid99");
  await expect(page.getByText("Mot de passe actuel incorrect")).toBeVisible();
});

test("T3_zod_validation_short_password", async ({ page }) => {
  await openPasswordDialog(page);
  await submitPasswordForm(page, ORIGINAL_PWD, "short", "short");
  await expect(page.getByText("Au moins 8 caractères")).toBeVisible();
});

test("T4_session_valid_after_change_navigate_clients", async ({ page }) => {
  try {
    await openPasswordDialog(page);
    await submitPasswordForm(page, ORIGINAL_PWD, TEMP_PWD, TEMP_PWD);
    await expect(page.getByText("Mot de passe modifié")).toBeVisible();

    await page.goto("/admin/clients");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/admin\/clients/);
  } finally {
    await resetPasswordViaDialog(page, TEMP_PWD, ORIGINAL_PWD);
  }
});
