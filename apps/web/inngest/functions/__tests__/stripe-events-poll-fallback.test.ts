import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const mockGetStripeClient = vi.fn();
const mockGetStripeEvent = vi.fn();
const mockRecordStripeEvent = vi.fn();
const mockGetInvoiceById = vi.fn();
const mockMarkStripeEventProcessed = vi.fn();
const mockCreatePayment = vi.fn();
const mockHandlePaymentIntentSucceeded = vi.fn();

vi.mock("@saas/services", () => ({
  getStripeClient: mockGetStripeClient,
  getStripeEvent: mockGetStripeEvent,
  recordStripeEvent: mockRecordStripeEvent,
  getInvoiceById: mockGetInvoiceById,
  paymentService: { createPayment: mockCreatePayment },
  markStripeEventProcessed: mockMarkStripeEventProcessed,
}));

vi.mock("../payment-intent-succeeded.handler", () => ({
  handlePaymentIntentSucceeded: mockHandlePaymentIntentSucceeded,
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

function mockStripeClient(events: unknown[]) {
  return {
    events: {
      list: () => makeAsyncIterable(events),
    },
  };
}

function makeStripeEvent(opts: {
  eventId?: string;
  piId?: string;
  invoiceId?: string;
  noInvoiceId?: boolean;
  amount?: number;
} = {}) {
  return {
    id: opts.eventId ?? "evt_test456",
    type: "payment_intent.succeeded",
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
    mockGetStripeClient.mockReturnValue(mockStripeClient([ev]));
    mockGetStripeEvent.mockResolvedValueOnce({ eventId: "evt_processed", processedAt: new Date() });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentSucceeded).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalScanned: 1, alreadyProcessed: 1, reInjected: 0 });
  });

  it("poll_fallback_reinjects_missed_succeeded_event", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    const ev = makeStripeEvent({ eventId: "evt_missed", invoiceId: "inv-456" });
    mockGetStripeClient.mockReturnValue(mockStripeClient([ev]));
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
    mockGetStripeClient.mockReturnValue(mockStripeClient([ev]));
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
    mockGetStripeClient.mockReturnValue(mockStripeClient([ev]));
    mockGetStripeEvent.mockResolvedValueOnce(null);
    mockRecordStripeEvent.mockResolvedValueOnce({ inserted: true });

    const result = await capturedHandler();

    expect(mockHandlePaymentIntentSucceeded).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalScanned: 1, skippedNoInvoiceId: 1, reInjected: 0 });
  });

  it("poll_fallback_returns_structured_counters", async () => {
    await import("@/inngest/functions/stripe-events-poll-fallback");
    mockGetStripeClient.mockReturnValue(mockStripeClient([]));

    const result = await capturedHandler();

    expect(result).toEqual({
      status: "completed",
      totalScanned: 0,
      alreadyProcessed: 0,
      reInjected: 0,
      skippedNoInvoiceId: 0,
    });
  });
});
