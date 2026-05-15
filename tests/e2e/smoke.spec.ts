import { test, expect } from "@playwright/test";

/**
 * Smoke tests — Phase 0 : Fondations
 *
 * Ces tests vérifient que l'app Next.js démarre et sert les pages de base.
 * Ils doivent passer avant tout merge dans main.
 */

test.describe("Smoke — App démarre", () => {
  test("la homepage répond avec un status 200", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
  });

  test("la homepage contient le titre SaaS Agentique", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SaaS Agentique/i);
  });

  test("la homepage rend le contenu sans erreur JS critique", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    // Attendre que la page soit stable
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Smoke — Routes statiques", () => {
  test("GET /login redirige ou répond (pas de 500)", async ({ request }) => {
    const response = await request.get("/login", {
      maxRedirects: 0,
    });
    // Accepte 200, 302, 307, 308 — mais pas 500
    expect(response.status()).toBeLessThan(500);
  });

  test("GET /register redirige ou répond (pas de 500)", async ({ request }) => {
    const response = await request.get("/register", {
      maxRedirects: 0,
    });
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe("Smoke — Sécurité de base", () => {
  test("une route protégée redirige vers /login si non authentifié", async ({
    browser,
  }) => {
    // On utilise un contexte vierge sans authentification pour ce test
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    // /some-tenant/dashboard est une route de l'app protégée par le middleware
    const response = await page.goto("/some-tenant/dashboard");
    // Soit redirect vers /login, soit page de login rendue
    const url = page.url();
    const status = response?.status() ?? 0;

    const isRedirectedToLogin =
      url.includes("/login") || url.includes("next=%2F");
    const isOkOrRedirect = status < 500;

    expect(isOkOrRedirect).toBe(true);
    expect(isRedirectedToLogin).toBe(true);
    await context.close();
  });
});
