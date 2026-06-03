import { describe, it, expect, vi } from "vitest";

vi.mock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
vi.mock("@saas/db", () => ({
  db: { select: vi.fn() },
  quotes: {},
  clients: {},
  clientContacts: {},
}));
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));

import { renderQuoteSentHtml } from "../emails/QuoteSentEmail";

const PROPS = {
  quoteNumber: "Q-2026-001",
  clientName: "ACME",
  totalTtcFormatted: "1 200,00 €",
  ctaUrl: "http://localhost:3001/account/quotes/uuid-1",
};

describe("QuoteSentEmail", () => {
  it("renders_html_with_all_props", async () => {
    const html = await renderQuoteSentHtml(PROPS);
    expect(html).toContain("Q-2026-001");
    expect(html).toContain("ACME");
    expect(html).toContain("1 200,00 €");
    expect(html).toContain("http://localhost:3001/account/quotes/uuid-1");
  });

  it("html_contains_cta_link", async () => {
    const html = await renderQuoteSentHtml(PROPS);
    expect(html).toContain('href="http://localhost:3001/account/quotes/uuid-1"');
  });
});
