import { describe, it, expect, vi, beforeEach } from "vitest";

const INVOICE_ID = "aaaa1111-1111-1111-1111-111111111111";
const CLIENT_ID = "bbbb2222-2222-2222-2222-222222222222";
const TENANT_ID = "cccc3333-3333-3333-3333-333333333333";
const ADMIN_EMAIL = "cedric@example.com";

const INVOICE_FIXTURE = {
  id: INVOICE_ID,
  ownerId: TENANT_ID,
  clientId: CLIENT_ID,
  number: "INV-2026-001",
  status: "sent" as const,
  totalEurCents: 100000,
  vatRateBps: 2000,
  dueAt: null,
  issuedAt: null,
  paidAt: null,
  quoteId: null,
  projectId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CLIENT_FIXTURE = {
  id: CLIENT_ID,
  name: "ACME Corp",
  email: "contact@acme.com",
};

const ADMIN_USER_FIXTURE = {
  id: TENANT_ID,
  email: ADMIN_EMAIL,
};

beforeEach(() => {
  vi.resetModules();
});

describe("dispatch_map_wiring", () => {
  it("dispatch_map_has_payment_failed_handler", async () => {
    vi.doMock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      quotes: {},
      clients: {},
      clientContacts: {},
      invoices: {},
      users: {},
      reports: {},
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));
    vi.doMock("resend", () => ({ Resend: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { DISPATCH_MAP } = await import("../notification.service");
    expect(DISPATCH_MAP["payment.failed"]).not.toBeNull();
    expect(typeof DISPATCH_MAP["payment.failed"]).toBe("function");
  });
});

describe("handler_payment_failed_email", () => {
  const buildDbMock = (
    invoiceResult: unknown[],
    clientResult: unknown[],
    adminUserResult: unknown[],
  ) => {
    const mockWhere = vi.fn()
      .mockResolvedValueOnce(invoiceResult)
      .mockResolvedValueOnce(clientResult)
      .mockResolvedValueOnce(adminUserResult);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    return { select: mockSelect };
  };

  it("sends_email_to_admin_on_valid_invoice", async () => {
    const mockEmailsSend = vi.fn().mockResolvedValue({ id: "email-id" });
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: true, RESEND_API_KEY: "test-key", APP_URL: "http://localhost:3001" },
    }));
    vi.doMock("@saas/db", () => {
      const db = buildDbMock([INVOICE_FIXTURE], [CLIENT_FIXTURE], [ADMIN_USER_FIXTURE]);
      return {
        db,
        invoices: { id: "id", number: "number", clientId: "clientId", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
        clients: { id: "id", name: "name" },
        users: { id: "id", email: "email" },
        clientContacts: {},
        quotes: {},
        reports: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("./invoice.shared", () => ({
      computeInvoiceTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("payment.failed", { invoiceId: INVOICE_ID, tenantId: TENANT_ID });

    expect(mockEmailsSend).toHaveBeenCalledTimes(1);
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ADMIN_EMAIL,
    }));
  });

  it("email_subject_contains_invoice_number", async () => {
    const mockEmailsSend = vi.fn().mockResolvedValue({ id: "email-id" });
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: true, RESEND_API_KEY: "test-key", APP_URL: "http://localhost:3001" },
    }));
    vi.doMock("@saas/db", () => {
      const db = buildDbMock([INVOICE_FIXTURE], [CLIENT_FIXTURE], [ADMIN_USER_FIXTURE]);
      return {
        db,
        invoices: { id: "id", number: "number", clientId: "clientId", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
        clients: { id: "id", name: "name" },
        users: { id: "id", email: "email" },
        clientContacts: {},
        quotes: {},
        reports: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("./invoice.shared", () => ({
      computeInvoiceTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("payment.failed", { invoiceId: INVOICE_ID, tenantId: TENANT_ID });

    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringMatching(/Échec paiement facture INV-/),
    }));
  });

  it("skips_email_when_notifications_disabled", async () => {
    const mockEmailsSend = vi.fn();
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: false, RESEND_API_KEY: "test-key" },
    }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      invoices: {},
      clients: {},
      users: {},
      clientContacts: {},
      quotes: {},
      reports: {},
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("payment.failed", { invoiceId: INVOICE_ID, tenantId: TENANT_ID });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});
