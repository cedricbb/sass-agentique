import { test as setup } from "@playwright/test";

setup("authenticate acme", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "client-acme@saas.dev");
  await page.fill('input[name="password"]', "client1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/account/);
  await page.context().storageState({ path: "tests/e2e/.auth/acme.json" });
});

setup("authenticate bob", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "client-bob@saas.dev");
  await page.fill('input[name="password"]', "client1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/account/);
  await page.context().storageState({ path: "tests/e2e/.auth/bob.json" });
});
