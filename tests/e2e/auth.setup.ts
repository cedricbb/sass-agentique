import { test as setup, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const authFile = 'tests/e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await loginAsAdmin(page);
  // On s'assure d'être bien sur le dashboard admin
  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: authFile });
});
