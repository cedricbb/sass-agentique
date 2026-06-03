import { describe, it, expect, vi } from "vitest";

vi.mock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
vi.mock("@saas/db", () => ({
  db: { select: vi.fn() },
  invoices: {},
  clients: {},
  clientContacts: {},
}));
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));

import { renderInvoiceSentHtml } from "../emails/InvoiceSentEmail";

const BASE_PROPS = {
  invoiceNumber: "INV-2026-001",
  clientName: "ACME Corp",
  totalTtcFormatted: "1 200,00 €",
  ctaUrl: "http://localhost:3001/account/invoices/uuid-1",
};

describe("InvoiceSentEmail", () => {
  it("renders_html_with_all_props", async () => {
    const html = await renderInvoiceSentHtml({ ...BASE_PROPS, dueDateFormatted: "15/07/2026" });
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("ACME Corp");
    expect(html).toContain("1 200,00 €");
    expect(html).toContain("http://localhost:3001/account/invoices/uuid-1");
    expect(html).toContain("15/07/2026");
  });

  it("renders_html_without_null_when_due_date_absent", async () => {
    const html = await renderInvoiceSentHtml({ ...BASE_PROPS, dueDateFormatted: null });
    expect(html).not.toContain("null");
  });

  it("renders_html_with_due_date_when_present", async () => {
    const html = await renderInvoiceSentHtml({ ...BASE_PROPS, dueDateFormatted: "15/07/2026" });
    expect(html).toContain("15/07/2026");
  });
});
