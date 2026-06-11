import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const mockGetStripeClient = vi.fn();
const mockGetStripeEvent = vi.fn();
const mockRecordStripeEvent = vi.fn();
const mockGetInvoiceById = vi.fn();
const mockMarkStripeEventProcessed = vi.fn();
const mockCreatePayment = vi.fn();
const mockHandlePaymentIntentSucceeded = vi.fn();
const mockHandlePaymentIntentFailed = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@saas/services/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

vi.mock("@saas/services", () => ({
  getStripeClient: mockGetStripeClient,
  getStripeEvent: mockGetStripeEvent,
  recordStripeEvent: mockRecordStripeEvent,
  getInvoiceById: mockGetInvoiceById,
  paymentService: { createPayment: mockCreatePayment },
  markStripeEventProcessed: mockMarkStripeEventProcessed,
  dispatchNotification: vi.fn(),
}));

vi.mock("../payment-intent-succeeded.handler", () => ({
  handlePaymentIntentSucceeded: mockHandlePaymentIntentSucceeded,
}));

vi.mock("../payment-intent-failed.handler", () => ({
  handlePaymentIntentFailed: mockHandlePaymentIntentFailed,
}));

let _capturedConfig: { id: string; retries: number };
let capturedTrigger: { cron: string };
let capturedHandler: () => Promise<unknown>;

vi.mock("@saas/workflows", () => ({
  inngest: {
    createFunction: vi.fn(
      (
        config: typeof _capturedConfig,
        trigger: typeof capturedTrigger,
        handler: typeof capturedHandler,
      ) => {
        _capturedConfig = config;
        capturedTrigger = trigger;
        capturedHandler = handler;
        return { id: config.id };
      },
    ),
  },
}));

async function* makeAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

function mockStripeClient(eventsByType: { succeeded?: unknown[]; failed?: unknown[] } = {}) {
  return {
    events: {
      list: (opts: { type: string }) => {
        if (opts.type === "payment_intent.failed") {
          return makeAsyncIterable(eventsByType.failed ?? []);
        }
        return makeAsyncIterable(eventsByType.succeeded ?? []);
      },
    },
  };
}

function makeStripeEvent(opts: {
  eventId?: string;
  piId?: string;
  invoiceId?: string;
  noInvoiceId?: boolean;
  amount?: number;
  type?: string;
} = {}) {
  return {
    id: opts.eventId ?? "evt_test456",
    type: opts.type ?? "payment_intent.succeeded",
    data: {
      object: {
        id: opts.piId ?? "pi_test123",
        amount: opts.amount ?? 10000,
        created: 1700000000,
        metadata: opts.noInvoiceId ? {} : { invoiceId: opts.invoiceId ?? "inv-uuid-123" },
      },
    },
  };
}

describe("stripeEventsPollFallbackCron", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("poll_fallback_cron_registered_in_inngest_functions", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions).toHaveLength(4);
    const ids = (inngestFunctions as unknown as ReadonlyArray<{ id: string }>).map((f) => f.id);
    expect(ids).toContain("stripe-events-poll-fallback-cron");
  });

  it("poll_fallback_cron_has_hourly_schedule", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    expect(capturedTrigger).toEqual({ cron: "0 * * * *" });
  });

  it("poll_fallback_cron_config_id_and_retries", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const { inngest } = await import("@saas/workflows");
    const createFunction = inngest.createFunction as Mock;
    const callArgs = createFunction.mock.calls[0];
    const config = callArgs?.[0] as { id: string; retries: number };
    expect(config.id).toBe("stripe-events-poll-fallback-cron");
    expect(config.retries).toBe(3);
  });

  it("poll_fallback_skips_already_processed_events", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_processed" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ succeeded: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce({ eventId: "evt_processed", processedAt: new Date() });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentSucceeded).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalScanned: 1, alreadyProcessed: 1, reInjected: 0 });
  });

  it("poll_fallback_reinjects_missed_succeeded_event", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_missed", invoiceId: "inv-456" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ succeeded: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });
    mockHandlePaymentIntentSucceeded.mockResolvedValueOnce({ status: "processed" });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentSucceeded).toHaveBeenCalledOnce();
    expect(mockHandlePaymentIntentSucceeded).toHaveBeenCalledWith(
      { data: { event: ev } },
      expect.objectContaining({
        getInvoiceById: expect.any(Function),
        createPayment: expect.any(Function),
        markStripeEventProcessed: expect.any(Function),
      }),
    );
    expect(result).toMatchObject({ totalScanned: 1, reInjected: 1, alreadyProcessed: 0 });
  });

  it("poll_fallback_records_event_before_reinjection", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_new", invoiceId: "inv-789" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ succeeded: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });
    mockHandlePaymentIntentSucceeded.mockResolvedValueOnce({ status: "processed" });

    await capturedHandler();

    expect(mockRecordStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_new", type: "payment_intent.succeeded" }),
    );
    expect(mockHandlePaymentIntentSucceeded).toHaveBeenCalledOnce();
    const recordCallOrder = mockRecordStripeEvent.mock.invocationCallOrder[0];
    const handleCallOrder = mockHandlePaymentIntentSucceeded.mock.invocationCallOrder[0];
    expect(recordCallOrder).toBeLessThan(handleCallOrder);
  });

  it("poll_fallback_skips_event_without_invoice_id", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_noinvoice", noInvoiceId: true });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ succeeded: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentSucceeded).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalScanned: 1, skippedNoInvoiceId: 1, reInjected: 0 });
  });

  it("poll_fallback_returns_structured_counters", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    mockGetStripeClient.mockReturnValue(mockStripeClient({}));

    const result = await capturedHandler();

    expect(result).toEqual({
      status: "completed",
      totalScanned: 0,
      alreadyProcessed: 0,
      reInjected: 0,
      skippedNoInvoiceId: 0,
      failedScanned: 0,
      failedAlreadyProcessed: 0,
      failedReInjected: 0,
    });
  });

  it("poll_fallback_emits_start_log", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    mockGetStripeClient.mockReturnValue(mockStripeClient({}));

    await capturedHandler();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inngest.cron.payment_intent_poll_fallback.start",
      { jobName: "payment_intent_poll_fallback" },
    );
  });

  it("poll_fallback_emits_completed_log_with_counters", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_c1", invoiceId: "inv-999" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ succeeded: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });
    mockHandlePaymentIntentSucceeded.mockResolvedValueOnce({ status: "processed" });

    await capturedHandler();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inngest.cron.payment_intent_poll_fallback.completed",
      {
        jobName: "payment_intent_poll_fallback",
        totalScanned: 1,
        alreadyProcessed: 0,
        reInjected: 1,
        skippedNoInvoiceId: 0,
        failedScanned: 0,
        failedAlreadyProcessed: 0,
        failedReInjected: 0,
      },
    );
  });

  it("poll_fallback_reinjects_missed_failed_event", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_failed_missed", invoiceId: "inv-failed-123", type: "payment_intent.failed" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ failed: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });
    mockHandlePaymentIntentFailed.mockResolvedValueOnce({ status: "notified", eventId: "evt_failed_missed", invoiceId: "inv-failed-123" });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentFailed).toHaveBeenCalledOnce();
    expect(mockHandlePaymentIntentFailed).toHaveBeenCalledWith(
      { data: { event: ev } },
      expect.objectContaining({
        getInvoiceById: expect.any(Function),
        dispatchNotification: expect.any(Function),
        markStripeEventProcessed: expect.any(Function),
      }),
    );
    expect(result).toMatchObject({ failedScanned: 1, failedReInjected: 1, failedAlreadyProcessed: 0 });
  });

  it("poll_fallback_skips_already_processed_failed_event", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_failed_processed", type: "payment_intent.failed" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ failed: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce({ eventId: "evt_failed_processed", processedAt: new Date() });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentFailed).not.toHaveBeenCalled();
    expect(result).toMatchObject({ failedScanned: 1, failedAlreadyProcessed: 1, failedReInjected: 0 });
  });

  it("poll_fallback_records_failed_event_before_reinjection", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_failed_new", invoiceId: "inv-failed-789", type: "payment_intent.failed" });
    mockGetStripeClient.mockReturnValue(mockStripeClient({ failed: [ev] }));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });
    mockHandlePaymentIntentFailed.mockResolvedValueOnce({ status: "logged", eventId: "evt_failed_new" });

    await capturedHandler();

    expect(mockRecordStripeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_failed_new", type: "payment_intent.failed" }),
    );
    expect(mockHandlePaymentIntentFailed).toHaveBeenCalledOnce();
    const recordCallOrder = mockRecordStripeEvent.mock.invocationCallOrder[0];
    const handleCallOrder = mockHandlePaymentIntentFailed.mock.invocationCallOrder[0];
    expect(recordCallOrder).toBeLessThan(handleCallOrder);
  });
});
