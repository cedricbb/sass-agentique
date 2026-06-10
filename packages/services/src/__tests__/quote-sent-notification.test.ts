import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const QUOTE_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";
const OWNER_ID = "33333333-3333-3333-3333-333333333333";

const QUOTE_FIXTURE = {
  id: QUOTE_ID,
  ownerId: OWNER_ID,
  clientId: CLIENT_ID,
  projectId: null,
  number: "Q-2026-001",
  status: "draft" as const,
  issuedAt: null,
  expiresAt: null,
  acceptedAt: null,
  totalEurCents: 100000,
  vatRateBps: 2000,
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
  it("dispatch_map_has_quote_sent_handler", async () => {
    vi.doMock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined, APP_URL: "http://localhost:3001" } }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      quotes: { id: "id", number: "number", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
      clients: { id: "id", name: "name" },
      clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
    }));
    vi.doMock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), isNotNull: vi.fn() }));
    vi.doMock("resend", () => ({ Resend: vi.fn() }));
    vi.doMock("../emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
    vi.doMock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));

    const { DISPATCH_MAP } = await import("../notification.service");
    expect(DISPATCH_MAP["quote.sent"]).not.toBeNull();
    expect(typeof DISPATCH_MAP["quote.sent"]).toBe("function");
  });
});

describe("quote_service_dispatch_hook", () => {
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

    const { transitionQuoteStatus } = await import("../quote.service");

    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, status: "sent" }]);

    await transitionQuoteStatus(QUOTE_ID, "sent");
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith("quote.sent", {
      clientId: CLIENT_ID,
      entityId: QUOTE_ID,
      tenantId: OWNER_ID,
    });
  });

  it("transition_succeeds_when_dispatch_throws", async () => {
    const mockDispatch = vi.fn().mockRejectedValue(new Error("Resend down"));
    vi.doMock("../notification.service", () => ({ dispatchNotification: mockDispatch }));

    const dbMock = makeDrizzleMock();
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

    const { transitionQuoteStatus } = await import("../quote.service");

    dbMock.limit.mockResolvedValueOnce([QUOTE_FIXTURE]);
    dbMock.returning.mockResolvedValueOnce([{ ...QUOTE_FIXTURE, status: "sent" }]);

    const result = await transitionQuoteStatus(QUOTE_ID, "sent");
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
    quoteResult: unknown[],
    clientResult: unknown[],
    contactsResult: unknown[],
  ) => {
    const mockWhere = vi.fn()
      .mockResolvedValueOnce(quoteResult)
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
      const db = buildDbMock([QUOTE_FIXTURE], [CLIENT_FIXTURE], CONTACTS_FIXTURE);
      return {
        db,
        quotes: { id: "id", number: "number", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({
      renderQuoteSentHtml: vi.fn().mockResolvedValue("<html>quote email</html>"),
    }));
    vi.doMock("./quote.shared", () => ({
      computeQuoteTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("quote.sent", { clientId: CLIENT_ID, entityId: QUOTE_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).toHaveBeenCalledTimes(CONTACTS_FIXTURE.length);
    expect(mockEmailsSend).toHaveBeenCalledWith(expect.objectContaining({
      to: "alice@acme.com",
      subject: "Nouveau devis Q-2026-001 disponible",
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
      const db = buildDbMock([QUOTE_FIXTURE], [CLIENT_FIXTURE], []);
      return {
        db,
        quotes: { id: "id", number: "number", totalEurCents: "totalEurCents", vatRateBps: "vatRateBps" },
        clients: { id: "id", name: "name" },
        clientContacts: { id: "id", name: "name", email: "email", userId: "userId", clientId: "clientId" },
      };
    });
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((...a: unknown[]) => ({ op: "eq", a })),
      and: vi.fn((...a: unknown[]) => ({ op: "and", a })),
      isNotNull: vi.fn((c: unknown) => ({ op: "isNotNull", c })),
    }));
    vi.doMock("../emails/QuoteSentEmail", () => ({
      renderQuoteSentHtml: vi.fn().mockResolvedValue("<html>quote email</html>"),
    }));
    vi.doMock("./quote.shared", () => ({
      computeQuoteTtc: vi.fn().mockReturnValue({ totalHtCents: 100000, vatCents: 20000, totalTtcCents: 120000 }),
    }));

    const { dispatchNotification } = await import("../notification.service");
    await dispatchNotification("quote.sent", { clientId: CLIENT_ID, entityId: QUOTE_ID, tenantId: OWNER_ID });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });
});
