import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { handlePaymentIntentSucceeded } from "@/inngest/functions/payment-intent-succeeded.handler";
import type { PaymentIntentSucceededDeps } from "@/inngest/functions/payment-intent-succeeded.handler";

const makeEvent = (
  overrides: {
    invoiceId?: string;
    amount?: number;
    piId?: string;
    created?: number;
    noMetadata?: boolean;
  } = {},
) => {
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
});

const makeDeps = (overrides: Partial<PaymentIntentSucceededDeps> = {}): PaymentIntentSucceededDeps => ({
  getInvoiceById: vi.fn().mockResolvedValue(makeInvoice()),
  createPayment: vi.fn().mockResolvedValue({ payment: {}, invoiceMarkedAsPaid: false }),
  markStripeEventProcessed: vi.fn().mockResolvedValue(null),
  ...overrides,
});

describe("handlePaymentIntentSucceeded", () => {
  it("creates_payment_for_valid_event", async () => {
    const deps = makeDeps();
    const event = makeEvent();

    const result = await handlePaymentIntentSucceeded(event as never, deps);

    expect(deps.getInvoiceById).toHaveBeenCalledWith("inv-uuid-123");
    expect(deps.createPayment).toHaveBeenCalledWith({
      invoiceId: "inv-uuid-123",
      ownerId: "owner-uuid-789",
      amountCents: 10000,
      method: "stripe_card",
      externalRef: "pi_test123",
      paidAt: new Date(1700000000 * 1000),
    });
    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(result).toMatchObject({
      status: "processed",
      invoiceId: "inv-uuid-123",
      paymentIntentId: "pi_test123",
      invoiceMarkedAsPaid: false,
    });
  });

  it("skips_when_no_invoice_id", async () => {
    const deps = makeDeps({ getInvoiceById: vi.fn() });
    const event = makeEvent({ noMetadata: true });

    const result = await handlePaymentIntentSucceeded(event as never, deps);

    expect(result).toMatchObject({ status: "skipped", reason: "no_invoice_id_metadata" });
    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("skips_when_amount_zero_or_negative", async () => {
    const depsZero = makeDeps({ getInvoiceById: vi.fn() });
    const resultZero = await handlePaymentIntentSucceeded(makeEvent({ amount: 0 }) as never, depsZero);
    expect(resultZero).toMatchObject({ status: "skipped", reason: "invalid_amount" });
    expect(depsZero.createPayment).not.toHaveBeenCalled();

    const depsNeg = makeDeps({ getInvoiceById: vi.fn() });
    const resultNeg = await handlePaymentIntentSucceeded(makeEvent({ amount: -100 }) as never, depsNeg);
    expect(resultNeg).toMatchObject({ status: "skipped", reason: "invalid_amount" });
    expect(depsNeg.createPayment).not.toHaveBeenCalled();
  });

  it("skips_when_invoice_not_found", async () => {
    const deps = makeDeps({ getInvoiceById: vi.fn().mockResolvedValue(null) });
    const event = makeEvent();

    const result = await handlePaymentIntentSucceeded(event as never, deps);

    expect(result).toMatchObject({ status: "skipped", reason: "invoice_not_found", invoiceId: "inv-uuid-123" });
    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(deps.createPayment).not.toHaveBeenCalled();
  });

  it("returns_processed_when_mark_processed_throws", async () => {
    const deps = makeDeps({
      markStripeEventProcessed: vi.fn().mockRejectedValue(new Error("mark failed")),
    });
    const event = makeEvent();

    const result = await handlePaymentIntentSucceeded(event as never, deps);

    expect(result).toMatchObject({ status: "processed", invoiceId: "inv-uuid-123" });
  });

  it("propagates_create_payment_error", async () => {
    const deps = makeDeps({
      createPayment: vi.fn().mockRejectedValue(new Error("DB connection error")),
    });
    const event = makeEvent();

    await expect(handlePaymentIntentSucceeded(event as never, deps)).rejects.toThrow("DB connection error");
    expect(deps.markStripeEventProcessed).not.toHaveBeenCalled();
  });

  it("no_direct_service_imports", () => {
    const handlerPath = fileURLToPath(
      new URL("../payment-intent-succeeded.handler.ts", import.meta.url),
    );
    const content = readFileSync(handlerPath, "utf-8");
    expect(content).not.toMatch(/from ['"]@saas\/(services|workflows)['"]/);
  });

  it("no_inngest_sdk_mocks", () => {
    const testPath = fileURLToPath(
      new URL("./payment-intent-succeeded.handler.test.ts", import.meta.url),
    );
    const content = readFileSync(testPath, "utf-8");
    expect(content).not.toMatch(/vi\.mock\(['"]@saas\/workflows['"]/);
  });
});
