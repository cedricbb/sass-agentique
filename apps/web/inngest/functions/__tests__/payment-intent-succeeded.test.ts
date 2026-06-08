import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const mockGetInvoiceById = vi.fn();
const mockCreatePayment = vi.fn();
const mockMarkStripeEventProcessed = vi.fn();
const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@saas/services", () => ({
  getInvoiceById: mockGetInvoiceById,
  paymentService: {
    createPayment: mockCreatePayment,
  },
  markStripeEventProcessed: mockMarkStripeEventProcessed,
}));

let capturedHandler: (args: { event: unknown; step: { run: (name: string, fn: () => unknown) => Promise<unknown> } }) => Promise<unknown>;

vi.mock("@saas/workflows", () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: typeof capturedHandler) => {
      capturedHandler = handler;
      return { id: "stripe-payment-intent-succeeded", retries: 3 };
    }),
  },
}));

const makeStep = () => ({
  run: vi.fn(async (_name: string, fn: () => unknown) => fn()),
});

const makeEvent = (overrides: { invoiceId?: string; amount?: number; piId?: string; created?: number; noMetadata?: boolean } = {}) => {
  const paymentIntent = {
    id: overrides.piId ?? "pi_test123",
    amount: overrides.amount ?? 10000,
    created: overrides.created ?? 1700000000,
    metadata: overrides.noMetadata ? {} : { invoiceId: overrides.invoiceId ?? "inv-uuid-123" },
  };
  return {
    data: {
      event: {
        id: "evt_test456",
        data: { object: paymentIntent },
      },
    },
  };
};

const makeInvoice = (id = "inv-uuid-123", ownerId = "owner-uuid-789") => ({
  id,
  ownerId,
  status: "draft",
  totalEurCents: 10000,
});

describe("paymentIntentSucceededHandler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("happy_path_creates_payment", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent();
    const invoice = makeInvoice();

    mockGetInvoiceById.mockResolvedValueOnce(invoice);
    mockCreatePayment.mockResolvedValueOnce({ payment: {}, invoiceMarkedAsPaid: false });
    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event, step });

    expect(mockGetInvoiceById).toHaveBeenCalledWith("inv-uuid-123");
    expect(mockCreatePayment).toHaveBeenCalledWith({
      invoiceId: "inv-uuid-123",
      ownerId: "owner-uuid-789",
      amountEurCents: 10000,
      method: "stripe_card",
      externalRef: "pi_test123",
      paidAt: new Date(1700000000 * 1000),
    });
    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(result).toMatchObject({ status: "processed", invoiceId: "inv-uuid-123", paymentIntentId: "pi_test123" });
  });

  it("skips_when_no_invoice_id_metadata", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent({ noMetadata: true });

    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event, step });

    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "skipped", reason: "no_invoice_id_metadata" });
  });

  it("skips_when_invoice_not_found", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent();

    mockGetInvoiceById.mockResolvedValueOnce(null);
    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event, step });

    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "skipped", reason: "invoice_not_found", invoiceId: "inv-uuid-123" });
  });

  it("propagates_create_payment_error", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent();
    const invoice = makeInvoice();

    mockGetInvoiceById.mockResolvedValueOnce(invoice);
    mockCreatePayment.mockRejectedValueOnce(new Error("DB connection error"));

    await expect(capturedHandler({ event, step })).rejects.toThrow("DB connection error");
    expect(mockMarkStripeEventProcessed).not.toHaveBeenCalled();
  });

  it("catches_mark_processed_error", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent();
    const invoice = makeInvoice();

    mockGetInvoiceById.mockResolvedValueOnce(invoice);
    mockCreatePayment.mockResolvedValueOnce({ payment: {}, invoiceMarkedAsPaid: true });
    mockMarkStripeEventProcessed.mockRejectedValueOnce(new Error("mark failed"));

    const result = await capturedHandler({ event, step });

    expect(mockConsoleError).toHaveBeenCalled();
    expect(result).toMatchObject({ status: "processed" });
  });

  it("skips_when_amount_is_zero", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent({ amount: 0 });

    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event, step });

    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "skipped", reason: "invalid_amount" });
  });

  it("skips_when_amount_is_negative", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent({ amount: -100 });

    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event, step });

    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "skipped", reason: "invalid_amount" });
  });

  it("skips_with_no_invoice_id_reason_when_both_missing", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const step = makeStep();
    const event = makeEvent({ amount: 0, noMetadata: true });

    mockMarkStripeEventProcessed.mockResolvedValueOnce(null);

    const result = await capturedHandler({ event, step });

    expect(mockMarkStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "skipped", reason: "no_invoice_id_metadata" });
  });

  it("handler_registered_in_inngest_functions", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions).toHaveLength(1);
  });

  it("function_config_id_and_retries", async () => {
    await import("@/inngest/functions/payment-intent-succeeded");
    const { inngest } = await import("@saas/workflows");
    const createFunction = inngest.createFunction as Mock;
    const callArgs = createFunction.mock.calls[0];
    const config = callArgs?.[0] as { id: string; retries: number };
    expect(config.id).toBe("stripe-payment-intent-succeeded");
    expect(config.retries).toBe(3);
  });
});
