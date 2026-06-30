import { test as setup, expect } from '@playwright/test';
import { loginAsAdmin, loginAsOwnerB } from './helpers/auth';

const authFile = 'tests/e2e/.auth/user.json';
const authFileOwnerB = 'tests/e2e/.auth/owner-b.json';

setup('authenticate', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: authFile });
});

setup('authenticate owner-b', async ({ page }) => {
  await loginAsOwnerB(page);
  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: authFileOwnerB });
});
