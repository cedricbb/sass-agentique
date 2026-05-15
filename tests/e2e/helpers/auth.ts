import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@saas.dev");
  await page.fill('input[name="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);
}
