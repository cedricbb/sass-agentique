import { test, expect } from "@playwright/test";

test.describe("Multi-tenant — Routing", () => {
  test("accès /{slug}/dashboard sans auth → redirect /login", async ({ page }) => {
    const response = await page.goto("/some-tenant/dashboard");
    const url = page.url();
    const status = response?.status() ?? 0;

    const isRedirectedToLogin =
      url.includes("/login") || url.includes("next=%2F");
    const isOkOrRedirect = status < 500;

    expect(isOkOrRedirect).toBe(true);
    expect(isRedirectedToLogin).toBe(true);
  });

  test("accès /unknown-xyz-tenant/dashboard → pas de 500", async ({
    page,
  }) => {
    const response = await page.goto("/unknown-xyz-tenant/dashboard", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBeLessThan(500);
  });
});
