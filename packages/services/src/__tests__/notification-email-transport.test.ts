import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockEmailsSend = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockCreateTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: mockSendMail })));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

vi.mock("../resend.client", () => ({
  getResendClient: vi.fn(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  isNotNull: vi.fn((col: unknown) => ({ op: "isNotNull", col })),
}));

vi.mock("@saas/db", () => ({
  db: { select: vi.fn() },
  clientContacts: {},
  quotes: {},
  clients: {},
  invoices: {},
  reports: {},
  users: {},
}));

vi.mock("./emails/QuoteSentEmail", () => ({ renderQuoteSentHtml: vi.fn() }));
vi.mock("./emails/InvoiceSentEmail", () => ({ renderInvoiceSentHtml: vi.fn() }));
vi.mock("./emails/ReportIssuedEmail", () => ({ renderReportIssuedHtml: vi.fn() }));
vi.mock("./quote.shared", () => ({ computeQuoteTtc: vi.fn() }));
vi.mock("./invoice.shared", () => ({ computeInvoiceTtc: vi.fn() }));
vi.mock("./report.shared", () => ({ REPORT_KIND_LABELS: {} }));

// ── Env mock (overridden per test) ────────────────────────────────────────────

import { getResendClient } from "../resend.client";

const FROM = "SaaS Agentique <noreply@saas-agentique.io>";

type EnvShape = {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  RESEND_API_KEY?: string;
  NOTIFICATIONS_ENABLED?: boolean;
};

async function importServiceWithEnv(envOverride: EnvShape) {
  vi.doMock("@saas/config", () => ({
    env: {
      NOTIFICATIONS_ENABLED: true,
      APP_URL: "http://localhost:3001",
      ...envOverride,
    },
  }));
  const mod = await import("../notification.service");
  return mod;
}

describe("notification sendNotificationEmail transport cascade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── AC1 — SMTP branch ──────────────────────────────────────────────────────

  it("smtp_transport_sends_via_nodemailer_when_smtp_host_set", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
    });

    vi.mocked(getResendClient);
    const { db } = await import("@saas/db");
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockCreateTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: FROM, to: "john@acme.com" }),
    );
  });

  it("smtp_transport_does_not_call_resend_when_smtp_host_set", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  // ── AC2 — Resend branch ────────────────────────────────────────────────────

  it("resend_transport_sends_when_no_smtp_and_resend_key_set", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      RESEND_API_KEY: "re_test_key",
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: FROM, to: "john@acme.com" }),
    );
  });

  it("resend_transport_does_not_call_nodemailer_when_no_smtp", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      RESEND_API_KEY: "re_test_key",
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  // ── AC3 — fallback console.log ─────────────────────────────────────────────

  it("fallback_console_log_when_no_transport_configured", async () => {
    const { dispatchNotification } = await importServiceWithEnv({});

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    const allArgs = consoleSpy.mock.calls.flat();
    const hasTo = allArgs.some((a) => typeof a === "object" && a !== null && "to" in a);
    const hasSubject = allArgs.some((a) => typeof a === "object" && a !== null && "subject" in a);
    expect(hasTo).toBe(true);
    expect(hasSubject).toBe(true);
  });

  it("fallback_does_not_call_nodemailer_or_resend", async () => {
    const { dispatchNotification } = await importServiceWithEnv({});

    vi.spyOn(console, "log").mockImplementation(() => {});

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockEmailsSend).not.toHaveBeenCalled();
  });

  // ── AC4 — FROM constant ────────────────────────────────────────────────────

  it("from_field_matches_canonical_sender_via_smtp", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: FROM }),
    );
  });

  it("from_field_matches_canonical_sender_via_resend", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      RESEND_API_KEY: "re_test_key",
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: FROM }),
    );
  });

  // ── AC5 — SMTP auth ────────────────────────────────────────────────────────

  it("smtp_auth_passed_when_user_and_pass_set", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
      SMTP_USER: "user",
      SMTP_PASS: "pass",
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "user", pass: "pass" } }),
    );
  });

  it("smtp_auth_undefined_when_user_or_pass_missing", async () => {
    const { dispatchNotification } = await importServiceWithEnv({
      SMTP_HOST: "localhost",
      SMTP_PORT: 1025,
    });

    const { db } = await import("@saas/db");
    const mockWhere = vi.fn();
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValue({ from: mockFrom2 } as never);

    const { renderQuoteSentHtml } = await import("./emails/QuoteSentEmail" as never as string) as { renderQuoteSentHtml: ReturnType<typeof vi.fn> };
    renderQuoteSentHtml.mockResolvedValue("<p>quote</p>");
    const { computeQuoteTtc } = await import("./quote.shared" as never as string) as { computeQuoteTtc: ReturnType<typeof vi.fn> };
    computeQuoteTtc.mockReturnValue({ totalTtcCents: 10000 });
    mockWhere.mockResolvedValueOnce([{ id: "q1", number: "Q-001", clientId: "c1" }]);
    mockWhere.mockResolvedValueOnce([{ id: "c1", name: "ACME" }]);
    mockWhere.mockResolvedValueOnce([{ id: "ct1", name: "John", email: "john@acme.com", userId: "u1" }]);

    await dispatchNotification("quote.sent", { clientId: "c1", entityId: "q1", tenantId: "t1" });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined }),
    );
  });
});
