import { test as setup } from "@playwright/test";

setup("authenticate admin", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@saas.dev");
  await page.fill('input[name="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/);
  await page.context().storageState({ path: "tests/e2e/.auth/admin.json" });
});

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

setup("authenticate globex", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "client-globex@saas.dev");
  await page.fill('input[name="password"]', "client1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/account/);
  await page.context().storageState({ path: "tests/e2e/.auth/globex.json" });
});
