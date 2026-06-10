import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const REPORT_ID = "aaaa1111-1111-1111-1111-111111111111";
const CLIENT_ID = "bbbb2222-2222-2222-2222-222222222222";
const OWNER_ID = "cccc3333-3333-3333-3333-333333333333";

const REPORT_FIXTURE = {
  id: REPORT_ID,
  ownerId: OWNER_ID,
  clientId: CLIENT_ID,
  projectId: null,
  title: "Rapport Mensuel ACME",
  kind: "delivery" as const,
  filePath: "/reports/acme/2026-01.pdf",
  summary: null,
  issuedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CLIENT_FIXTURE = {
  id: CLIENT_ID,
  name: "ACME Corp",
  email: "contact@acme.com",
};

const CONTACTS_FIXTURE = [
  { id: "contact-1", name: "Alice", email: "alice@acme.com", userId: "user-1" },
  { id: "contact-2", name: "Bob", email: "bob@acme.com", userId: "user-2" },
];

beforeEach(() => {
  vi.resetModules();
});

describe("dispatch_map_wiring", () => {
  it("dispatch_map_has_report_issued_handler", async () => {
    vi.doMock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      quotes: {},
      clients: {},
      clientContacts: {},
      invoices: {},
      reports: {},
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));
    vi.doMock("resend", () => ({ Resend: vi.fn() }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { DISPATCH_MAP } = await import("../notification.service");
    expect(DISPATCH_MAP["report.issued"]).not.toBeNull();
    expect(typeof DISPATCH_MAP["report.issued"]).toBe("function");
  });
});

describe("report_service_dispatch_hook", () => {
  const makeDrizzleMock = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ["select", "from", "where", "limit", "insert", "values", "returning", "update", "set", "delete", "orderBy"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnThis();
    }
    chain.transaction = vi.fn(async (fn: (tx: typeof chain) => unknown) => fn(chain));
    return chain;
  };

  it("mark_issued_calls_dispatch_notification", async () => {
    const mockDispatch = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = makeDrizzleMock();
    vi.doMock("@saas/db", () => ({
      get db() { return dbMock; },
      reports: { id: "id", clientId: "clientId", ownerId: "ownerId", issuedAt: "issuedAt" },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNull: vi.fn((c: unknown) => ({ op: "isNull", c })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
      desc: vi.fn((c: unknown) => ({ op: "desc", c })),
    }));

    const { markReportIssued } = await import("../report.service");

    dbMock.limit.mockResolvedValueOnce([REPORT_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...REPORT_FIXTURE, issuedAt: new Date() }]);

    await markReportIssued(REPORT_ID);
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith("report.issued", {
      clientId: CLIENT_ID,
      entityId: REPORT_ID,
      tenantId: OWNER_ID,
    });
  });

  it("mark_issued_skips_dispatch_when_already_issued", async () => {
    const mockDispatch = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = makeDrizzleMock();
    vi.doMock("@saas/db", () => ({
      get db() { return dbMock; },
      reports: { id: "id", clientId: "clientId", ownerId: "ownerId", issuedAt: "issuedAt" },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNull: vi.fn((c: unknown) => ({ op: "isNull", c })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
      desc: vi.fn((c: unknown) => ({ op: "desc", c })),
    }));

    const { markReportIssued } = await import("../report.service");

    dbMock.limit.mockResolvedValueOnce([{ ...REPORT_FIXTURE, issuedAt: new Date() }]);

    await markReportIssued(REPORT_ID);

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("mark_issued_succeeds_when_dispatch_throws", async () => {
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockDispatch = vi.fn().mockRejectedValue(new Error("Resend down"));
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = makeDrizzleMock();
    vi.doMock("@saas/db", () => ({
      get db() { return dbMock; },
      reports: { id: "id", clientId: "clientId", ownerId: "ownerId", issuedAt: "issuedAt" },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNull: vi.fn((c: unknown) => ({ op: "isNull", c })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
      desc: vi.fn((c: unknown) => ({ op: "desc", c })),
    }));

    const { markReportIssued } = await import("../report.service");

    const updatedReport = { ...REPORT_FIXTURE, issuedAt: new Date() };
    dbMock.limit.mockResolvedValueOnce([REPORT_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([updatedReport]);

    const result = await markReportIssued(REPORT_ID);
    await Promise.resolve();

    expect(result).toBeTruthy();
    expect(result?.id).toBe(REPORT_ID);
    expect(mockConsoleError).toHaveBeenCalled();

    mockConsoleError.mockRestore();
  });
});

describe("handler_email_dispatch", () => {
  beforeEach(() => {
    vi.doUnmock("../notification.service");
  });

  const buildDbMock = (
    reportResult: unknown[],
    clientResult: unknown[],
    contactsResult: unknown[],
  ) => {
    const mockWhere = vi.fn()
      .mockResolvedValueOnce(reportResult)
      .mockResolvedValueOnce(clientResult)
      .mockResolvedValueOnce(contactsResult);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    return { select: mockSelect };
  };

  it("handler_sends_email_to_each_contact", async () => {
    const mockEmailsSend = vi.fn().mockResolvedValue({ id: "email-id" });
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: true, RESEND_API_KEY: "test-key", APP_URL: "http://localhost:3001" },
    }));
    vi.doMock("@saas/db", () => {
      const db = buildDbMock([REPORT_FIXTURE], [CLIENT_FIXTURE], CONTACTS_FIXTURE);
      return {
        db,
        reports: { id: "id", kind: "kind", title: "title", issuedAt: "issuedAt" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
        quotes: {},
        invoices: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({
      renderReportIssuedHtml: vi.fn().mockResolvedValue("<html>report email</html>"),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("report.issued", { clientId: CLIENT_ID, entityId: REPORT_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).toHaveBeenCalledTimes(CONTACTS_FIXTURE.length);
    const firstSubject = mockEmailsSend.mock.calls[0][0].subject as string;
    expect(firstSubject).toContain("Rapport Mensuel ACME");
    expect(firstSubject).toContain("Livraison");
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({ to: "alice@acme.com" }));
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({ to: "bob@acme.com" }));
  });

  it("handler_skips_send_when_report_not_found", async () => {
    const mockEmailsSend = vi.fn().mockResolvedValue({ id: "email-id" });
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: true, RESEND_API_KEY: "test-key", APP_URL: "http://localhost:3001" },
    }));
    vi.doMock("@saas/db", () => {
      const db = buildDbMock([], [CLIENT_FIXTURE], CONTACTS_FIXTURE);
      return {
        db,
        reports: { id: "id", kind: "kind", title: "title", issuedAt: "issuedAt" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
        quotes: {},
        invoices: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("report.issued", { clientId: CLIENT_ID, entityId: REPORT_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  it("handler_skips_send_when_no_contacts", async () => {
    const mockEmailsSend = vi.fn().mockResolvedValue({ id: "email-id" });
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: true, RESEND_API_KEY: "test-key", APP_URL: "http://localhost:3001" },
    }));
    vi.doMock("@saas/db", () => {
      const db = buildDbMock([REPORT_FIXTURE], [CLIENT_FIXTURE], []);
      return {
        db,
        reports: { id: "id", kind: "kind", title: "title", issuedAt: "issuedAt" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
        quotes: {},
        invoices: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("report.issued", { clientId: CLIENT_ID, entityId: REPORT_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});
