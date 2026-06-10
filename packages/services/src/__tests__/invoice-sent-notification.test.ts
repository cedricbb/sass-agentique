import { describe, it, expect, vi, beforeEach } from "vitest";

const INVOICE_ID = "aaaa1111-1111-1111-1111-111111111111";
const CLIENT_ID = "bbbb2222-2222-2222-2222-222222222222";
const OWNER_ID = "cccc3333-3333-3333-3333-333333333333";

const INVOICE_FIXTURE = {
  id: INVOICE_ID,
  ownerId: OWNER_ID,
  clientId: CLIENT_ID,
  number: "INV-2026-001",
  status: "draft" as const,
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

const CONTACTS_FIXTURE = [
  { id: "contact-1", name: "Alice", email: "alice@acme.com", userId: "user-1" },
  { id: "contact-2", name: "Bob", email: "bob@acme.com", userId: "user-2" },
];

beforeEach(() => {
  vi.resetModules();
});

describe("dispatch_map_wiring", () => {
  it("dispatch_map_has_invoice_sent_handler", async () => {
    vi.doMock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      quotes: {},
      clients: {},
      clientContacts: {},
      invoices: {},
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));
    vi.doMock("resend", () => ({ Resend: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
    vi.doMock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));

    const { DISPATCH_MAP } = await import("../notification.service");
    expect(DISPATCH_MAP["invoice.sent"]).not.toBeNull();
    expect(typeof DISPATCH_MAP["invoice.sent"]).toBe("function");
  });
});

describe("invoice_service_dispatch_hook", () => {
  const makeDrizzleMock = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ["select", "from", "where", "limit", "insert", "values", "returning", "update", "set", "delete", "orderBy"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnThis();
    }
    chain.transaction = vi.fn(async (fn: (tx: typeof chain) => unknown) => fn(chain));
    return chain;
  };

  it("transition_to_sent_calls_dispatch_notification", async () => {
    const mockDispatch = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = makeDrizzleMock();
    vi.doMock("@saas/db", () => ({
      get db() { return dbMock; },
      invoices: { id: "id", ownerId: "ownerId", clientId: "clientId", number: "number", status: "status", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
      invoiceItems: { id: "id", invoiceId: "invoiceId" },
      invoiceStatusEnum: { enumValues: ["draft", "sent", "paid", "overdue", "cancelled"] },
      quotes: { id: "id" },
      quoteItems: { id: "id" },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      inArray: vi.fn((...a: unknown[]) => ({ op: "inArray", a })),
      desc: vi.fn((c: unknown) => ({ op: "desc", c })),
      like: vi.fn((...a: unknown[]) => ({ op: "like", a })),
    }));

    const { transitionInvoiceStatus } = await import("../invoice.service");

    dbMock.limit.mockResolvedValueOnce([INVOICE_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...INVOICE_FIXTURE, status: "sent" }]);

    await transitionInvoiceStatus(INVOICE_ID, "sent");
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith("invoice.sent", {
      clientId: CLIENT_ID,
      entityId: INVOICE_ID,
      tenantId: OWNER_ID,
    });
  });

  it("transition_succeeds_when_dispatch_throws", async () => {
    const mockDispatch = vi.fn().mockRejectedValue(new Error("Resend down"));
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = makeDrizzleMock();
    vi.doMock("@saas/db", () => ({
      get db() { return dbMock; },
      invoices: { id: "id", ownerId: "ownerId", clientId: "clientId", number: "number", status: "status", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
      invoiceItems: { id: "id", invoiceId: "invoiceId" },
      invoiceStatusEnum: { enumValues: ["draft", "sent", "paid", "overdue", "cancelled"] },
      quotes: { id: "id" },
      quoteItems: { id: "id" },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      inArray: vi.fn((...a: unknown[]) => ({ op: "inArray", a })),
      desc: vi.fn((c: unknown) => ({ op: "desc", c })),
      like: vi.fn((...a: unknown[]) => ({ op: "like", a })),
    }));

    const { transitionInvoiceStatus } = await import("../invoice.service");

    dbMock.limit.mockResolvedValueOnce([INVOICE_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...INVOICE_FIXTURE, status: "sent" }]);

    const result = await transitionInvoiceStatus(INVOICE_ID, "sent");
    await Promise.resolve();

    expect(result).toBeTruthy();
    expect(result?.status).toBe("sent");
  });
});

describe("handler_email_dispatch", () => {
  beforeEach(() => {
    vi.doUnmock("../notification.service");
  });

  const buildDbMock = (
    invoiceResult: unknown[],
    clientResult: unknown[],
    contactsResult: unknown[],
  ) => {
    const mockWhere = vi.fn()
      .mockResolvedValueOnce(invoiceResult)
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
      const db = buildDbMock([INVOICE_FIXTURE], [CLIENT_FIXTURE], CONTACTS_FIXTURE);
      return {
        db,
        invoices: { id: "id", number: "number", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps", dueAt: "dueAt" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
        quotes: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({
      renderInvoiceSentHtml: vi.fn().mockResolvedValue("<html>invoice email</html>"),
    }));
    vi.doMock("./invoice.shared", () => ({
      computeInvoiceTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("invoice.sent", { clientId: CLIENT_ID, entityId: INVOICE_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).toHaveBeenCalledTimes(CONTACTS_FIXTURE.length);
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "alice@acme.com",
      subject: `Nouvelle facture INV-2026-001 disponible`,
    }));
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "bob@acme.com",
    }));
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
      const db = buildDbMock([INVOICE_FIXTURE], [CLIENT_FIXTURE], []);
      return {
        db,
        invoices: { id: "id", number: "number", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps", dueAt: "dueAt" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
        quotes: {},
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({
      renderInvoiceSentHtml: vi.fn().mockResolvedValue("<html>invoice email</html>"),
    }));
    vi.doMock("./invoice.shared", () => ({
      computeInvoiceTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("invoice.sent", { clientId: CLIENT_ID, entityId: INVOICE_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});

describe("quote_sent_catch_logs_error", () => {
  const QUOTE_UUID = "dddd4444-4444-4444-4444-444444444444";
  const QUOTE_OWNER_UUID = "eeee5555-5555-5555-5555-555555555555";
  const QUOTE_CLIENT_UUID = "ffff6666-6666-6666-6666-666666666666";

  beforeEach(() => {
    vi.resetModules();
  });

  it("quote_sent_catch_logs_error", async () => {
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockDispatch = vi.fn().mockRejectedValue(new Error("dispatch boom"));
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = (() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      const methods = ["select", "from", "where", "limit", "insert", "values", "returning", "update", "set", "delete", "orderBy"];
      for (const m of methods) {
        chain[m] = vi.fn().mockReturnThis();
      }
      chain.transaction = vi.fn(async (fn: (tx: typeof chain) => unknown) => fn(chain));
      return chain;
    })();

    const QUOTE_FIXTURE = {
      id: QUOTE_UUID,
      ownerId: QUOTE_OWNER_UUID,
      clientId: QUOTE_CLIENT_UUID,
      number: "Q-2026-001",
      status: "draft" as const,
      totalEurCents: 1000,
      vatRateBps: 0,
    };

    vi.doMock("@saas/db", () => ({
      get db() { return dbMock; },
      quotes: { id: "id", ownerId: "ownerId", clientId: "clientId", number: "number", status: "status", totalEurCents: "totalEurCents" },
      quoteItems: { id: "id", quoteId: "quoteId" },
      quoteStatusEnum: { enumValues: ["draft", "sent", "accepted", "declined", "expired"] },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      inArray: vi.fn((...a: unknown[]) => ({ op: "inArray", a })),
      desc: vi.fn((c: unknown) => ({ op: "desc", c })),
      like: vi.fn((...a: unknown[]) => ({ op: "like", a })),
    }));

    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, status: "sent" }]);

    const { transitionQuoteStatus } = await import("../quote.service");
    await transitionQuoteStatus(QUOTE_UUID, "sent");
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('"event":"quote.sent"'),
    );

    mockConsoleError.mockRestore();
  });
});

describe("notifications_flag_behavior", () => {
  beforeEach(() => {
    vi.doUnmock("../notification.service");
  });

  it("dispatches_notification_when_env_enabled", async () => {
    const mockEmailsSend = vi.fn().mockResolvedValue({ id: "email-id" });
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: true, RESEND_API_KEY: "test-key", APP_URL: "http://localhost:3001" },
    }));
    const mockWhere = vi.fn()
      .mockResolvedValueOnce([INVOICE_FIXTURE])
      .mockResolvedValueOnce([CLIENT_FIXTURE])
      .mockResolvedValueOnce(CONTACTS_FIXTURE);
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) }) },
      invoices: { id: "id", number: "number", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps", dueAt: "dueAt" },
      clients: { id: "id", name: "name" },
      clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
      quotes: {},
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/InvoiceSentEmail", () => ({
      renderInvoiceSentHtml: vi.fn().mockResolvedValue("<html>invoice email</html>"),
    }));
    vi.doMock("./invoice.shared", () => ({
      computeInvoiceTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("invoice.sent", { clientId: CLIENT_ID, entityId: INVOICE_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).toHaveBeenCalled();
  });

  it("skips_notification_when_env_disabled", async () => {
    const mockEmailsSend = vi.fn();
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockEmailsSend } })),
    }));
    vi.doMock("@saas/config", () => ({
      env: { NOTIFICATIONS_ENABLED: false, RESEND_API_KEY: "test-key" },
    }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("invoice.sent", { clientId: CLIENT_ID, entityId: INVOICE_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});
