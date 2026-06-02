import { test, expect, type Page } from "@playwright/test";
import { addClientContact, createInvitation } from "@saas/services";
import {
  resolveClientIdBySlug,
  getInvitationTokenForContact,
  resolveAdminId,
} from "./helpers/resolve-seed-ids";

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@saas.dev");
  await page.fill('input[name="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);
}

test("Scenario A set-new — invite nouveau user → set-password → account → admin verifie Compte cree", async ({ page }) => {
  const newUserEmail = `e2e-newuser-${Date.now()}@test.dev`;

  const [acmeClientId, adminId] = await Promise.all([
    resolveClientIdBySlug("acme-studio"),
    resolveAdminId(),
  ]);

  const contact = await addClientContact({
    clientId: acmeClientId,
    name: "New User",
    email: newUserEmail,
  });
  const { token } = await createInvitation({
    clientId: acmeClientId,
    contactId: contact.id,
    email: newUserEmail,
    invitedBy: adminId,
  });

  await page.goto(`/set-password?token=${token}`);
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.locator('input[name="confirm"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Lier mon compte existant" })).not.toBeVisible();

  await page.fill('input[name="password"]', "Test1234");
  await page.fill('input[name="confirm"]', "Test1234");
  await page.getByRole("button", { name: "Créer mon mot de passe" }).click();
  await page.waitForURL(/\/account\//);
  await expect(page).toHaveURL(/\/account\//);

  await page.context().clearCookies();

  await loginAdmin(page);
  await page.goto(`/admin/clients/${acmeClientId}/`);
  await expect(page.getByText("Compte créé")).toBeVisible();
});

test("Scenario B link-existing — invite user existant → link account → account → admin verifie Compte cree", async ({ page }) => {
  const existingUserEmail = `e2e-existing-${Date.now()}@test.dev`;

  await page.goto("/register");
  await page.fill('input[name="email"]', existingUserEmail);
  await page.fill('input[name="password"]', "Existing1234");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL(/\/account\/profile/);

  await page.context().clearCookies();

  const [bobClientId, adminId] = await Promise.all([
    resolveClientIdBySlug("bob-indep"),
    resolveAdminId(),
  ]);

  const contact = await addClientContact({
    clientId: bobClientId,
    name: "Existing User",
    email: existingUserEmail,
  });
  await createInvitation({
    clientId: bobClientId,
    contactId: contact.id,
    email: existingUserEmail,
    invitedBy: adminId,
  });

  const token = await getInvitationTokenForContact(existingUserEmail);

  await page.goto(`/set-password?token=${token}`);
  await expect(page.locator('input[name="password"]')).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Lier mon compte existant" })).toBeVisible();
  await expect(page.getByText("Vous avez déjà un compte chez nous")).toBeVisible();

  await page.getByRole("button", { name: "Lier mon compte existant" }).click();
  await page.waitForURL(/\/account\//);
  await expect(page).toHaveURL(/\/account\//);

  await page.context().clearCookies();

  await loginAdmin(page);
  await page.goto(`/admin/clients/${bobClientId}/`);
  await expect(page.getByText("Compte créé")).toBeVisible();
});
