import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("@saas/services/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockGetInvoiceById = vi.fn();
const mockDispatchNotification = vi.fn();
const mockMarkStripeEventProcessed = vi.fn();
const mockHandlePaymentIntentFailed = vi.fn();

vi.mock("@saas/services", () => ({
  getInvoiceById: mockGetInvoiceById,
  dispatchNotification: mockDispatchNotification,
  markStripeEventProcessed: mockMarkStripeEventProcessed,
}));

vi.mock("../payment-intent-failed.handler", () => ({
  handlePaymentIntentFailed: mockHandlePaymentIntentFailed,
}));

let capturedHandler: (args: {
  event: unknown;
  step: { run: (name: string, fn: () => unknown) => Promise<unknown> };
}) => Promise<unknown>;

vi.mock("@saas/workflows", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { id: "stripe-payment-intent-failed", retries: 3 };
    }),
  },
}));

const makeStep = () => ({
  run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
});

const makeEvent = (overrides: { invoiceId?: string; noMetadata?: boolean } = {}) => ({
  data: {
    event: {
      id: "evt_test456",
      data: {
        object: {
          id: "pi_test123",
          amount: 10000,
          metadata: overrides.noMetadata ? {} : { invoiceId: overrides.invoiceId ?? "inv-uuid-123" },
          last_payment_error: { code: "card_declined", decline_code: "insufficient_funds", message: "Funds low" },
        },
      },
    },
  },
});

describe("paymentIntentFailedHandler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("delegates_to_handle_payment_intent_failed", async () => {
    await import("@/inngest/functions/payment-intent-failed");
    const step = makeStep();
    const event = makeEvent();
    mockHandlePaymentIntentFailed.mockResolvedValueOnce({ status: "notified", eventId: "evt_test456", invoiceId: "inv-uuid-123" });

    const result = await capturedHandler({ event, step });

    expect(mockHandlePaymentIntentFailed).toHaveBeenCalledWith(
      { data: event.data },
      expect.objectContaining({
        getInvoiceById: expect.any(Function),
        dispatchNotification: expect.any(Function),
        markStripeEventProcessed: expect.any(Function),
      }),
    );
    expect(result).toMatchObject({ status: "notified", eventId: "evt_test456" });
  });

  it("handler_registered_in_inngest_functions", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions).toHaveLength(4);
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
