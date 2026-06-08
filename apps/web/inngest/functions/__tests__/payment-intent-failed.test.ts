import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const mockMarkStripeEventProcessed = vi.fn();
const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@saas/services", () => ({
  getInvoiceById: vi.fn(),
  paymentService: { createPayment: vi.fn() },
  markStripeEventProcessed: mockMarkStripeEventProcessed,
}));

let capturedHandler: (args: { event: unknown }) => Promise<unknown>;

vi.mock("@saas/workflows", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { id: "stripe-payment-intent-failed", retries: 3 };
    }),
  },
}));

const makeEvent = (overrides: {
  eventId?: string;
  piId?: string;
  amount?: number;
  invoiceId?: string;
  lastPaymentError?: { code?: string; decline_code?: string; message?: string } | null;
  noMetadata?: boolean;
} = {}) => {
  const paymentIntent: Record<string, unknown> = {
    id: overrides.piId ?? "pi_test123",
    amount: overrides.amount ?? 10000,
    metadata: overrides.noMetadata ? {} : { invoiceId: overrides.invoiceId ?? "inv-uuid-123" },
  };
  if ("lastPaymentError" in overrides) {
    paymentIntent.last_payment_error = overrides.lastPaymentError;
  } else {
    paymentIntent.last_payment_error = {
      code: "card_declined",
      decline_code: "insufficient_funds",
      message: "Your card has insufficient funds.",
    };
  }
  return {
    data: {
      event: {
        id: overrides.eventId ?? "evt_test456",
        data: { object: paymentIntent },
      },
    },
  };
};

describe("paymentIntentFailedHandler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("happy_path_returns_logged_status", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const event = makeEvent();
    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event });

    expect(result).toMatchObject({ status: "logged", eventId: "evt_test456" });
  });

  it("emits_structured_log_with_all_fields", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const event = makeEvent();
    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    await capturedHandler({ event });

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('"paymentIntentId":"pi_test123"'));
    const firstCall = mockConsoleError.mock.calls[0][0] as string;
    const parsed = JSON.parse(firstCall);
    expect(parsed).toMatchObject({
      event: "stripe-payment-intent-failed",
      outcome: "logged",
      eventId: "evt_test456",
      paymentIntentId: "pi_test123",
      invoiceId: "inv-uuid-123",
      amount: 10000,
      errorCode: "card_declined",
      declineCode: "insufficient_funds",
      errorMessage: "Your card has insufficient funds.",
    });
  });

  it("calls_mark_stripe_event_processed", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const event = makeEvent();
    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    await capturedHandler({ event });

    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
  });

  it("catches_mark_processed_error_without_propagation", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const event = makeEvent();
    mockMarkStripeEventProcessed.mockRejectedValueOnce(new Error("db down"));

    const result = await capturedHandler({ event });

    expect(result).toMatchObject({ status: "logged" });
    const errorCalls = mockConsoleError.mock.calls.map((c) => c[0] as string);
    const errorLog = errorCalls.find((c) => c.includes("mark_processed_error"));
    expect(errorLog).toBeDefined();
    const parsed = JSON.parse(errorLog!);
    expect(parsed).toMatchObject({
      event: "stripe-payment-intent-failed",
      outcome: "mark_processed_error",
      eventId: "evt_test456",
      message: "db down",
    });
  });

  it("handles_null_last_payment_error", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const event = makeEvent({ lastPaymentError: null });
    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event });

    expect(result).toMatchObject({ status: "logged" });
    const firstCall = mockConsoleError.mock.calls[0][0] as string;
    const parsed = JSON.parse(firstCall);
    expect(parsed.errorCode).toBeNull();
    expect(parsed.declineCode).toBeNull();
    expect(parsed.errorMessage).toBeNull();
  });

  it("handler_registered_in_inngest_functions", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions).toHaveLength(3);
  });

  it("function_config_id_and_retries", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const { inngest } = await import("@saas/workflows");
    const createFunction = inngest.createFunction as Mock;
    const callArgs = createFunction.mock.calls[0];
    const config = callArgs?.[0] as { id: string; retries: number };
    expect(config.id).toBe("stripe-payment-intent-failed");
    expect(config.retries).toBe(3);
  });
});
