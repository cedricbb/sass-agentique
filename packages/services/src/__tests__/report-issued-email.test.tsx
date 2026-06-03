import { describe, it, expect, vi } from "vitest";

vi.mock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
vi.mock("@saas/db", () => ({
  db: { select: vi.fn() },
  reports: {},
  clients: {},
  clientContacts: {},
  quotes: {},
  invoices: {},
}));
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));

import { renderReportIssuedHtml } from "../emails/ReportIssuedEmail";

const REPORT_ID = "aaaa1111-1111-1111-1111-111111111111";

const BASE_PROPS = {
  reportTitle: "Rapport Mensuel ACME",
  kindLabel: "Livraison",
  clientName: "ACME Corp",
  issuedAtFormatted: "03/06/2026",
  ctaUrl: `http://localhost:3001/account/reports/${REPORT_ID}`,
};

describe("ReportIssuedEmail", () => {
  it("renders_html_with_all_props", async () => {
    const html = await renderReportIssuedHtml(BASE_PROPS);
    expect(html).toContain("Rapport Mensuel ACME");
    expect(html).toContain("Livraison");
    expect(html).toContain("ACME Corp");
    expect(html).toContain("03/06/2026");
    expect(html).toContain(`http://localhost:3001/account/reports/${REPORT_ID}`);
  });

  it("cta_points_to_account_reports_detail", async () => {
    const html = await renderReportIssuedHtml(BASE_PROPS);
    expect(html).toContain("/account/reports/");
  });
});
