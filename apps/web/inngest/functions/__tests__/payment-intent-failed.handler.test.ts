import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { logger } from "@saas/services/logger";
import { handlePaymentIntentFailed } from "@/inngest/functions/payment-intent-failed.handler";
import type { PaymentIntentFailedDeps } from "@/inngest/functions/payment-intent-failed.handler";

vi.mock("@saas/services/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const makeEvent = (
  overrides: {
    eventId?: string;
    piId?: string;
    amount?: number;
    invoiceId?: string;
    lastPaymentError?: { code?: string; decline_code?: string; message?: string } | null;
    noMetadata?: boolean;
  } = {},
) => {
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

const makeDeps = (overrides: Partial<PaymentIntentFailedDeps> = {}): PaymentIntentFailedDeps => ({
  getInvoiceById: vi.fn().mockResolvedValue({ id: "inv-uuid-123", ownerId: "owner-uuid-789" }),
  dispatchNotification: vi.fn().mockResolvedValue(null),
  markStripeEventProcessed: vi.fn().mockResolvedValue(null),
  ...overrides,
});

describe("handlePaymentIntentFailed", () => {
  it("notifies_when_invoice_found", async () => {
    const deps = makeDeps();
    const event = makeEvent();

    const result = await handlePaymentIntentFailed(event as never, deps);

    expect(deps.dispatchNotification).toHaveBeenCalledWith("payment.failed", {
      invoiceId: "inv-uuid-123",
      tenantId: "owner-uuid-789",
    });
    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(result).toMatchObject({ status: "notified", eventId: "evt_test456", invoiceId: "inv-uuid-123" });
  });

  it("returns_logged_when_no_invoice_id", async () => {
    const deps = makeDeps({ getInvoiceById: vi.fn() });
    const event = makeEvent({ noMetadata: true });

    const result = await handlePaymentIntentFailed(event as never, deps);

    expect(deps.dispatchNotification).not.toHaveBeenCalled();
    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(result).toMatchObject({ status: "logged", eventId: "evt_test456" });
  });

  it("returns_logged_when_notification_throws", async () => {
    const deps = makeDeps({
      dispatchNotification: vi.fn().mockRejectedValue(new Error("Resend down")),
    });
    const event = makeEvent();

    const result = await handlePaymentIntentFailed(event as never, deps);

    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(result).toMatchObject({ status: "logged", eventId: "evt_test456" });
  });

  it("returns_result_when_mark_processed_throws", async () => {
    const deps = makeDeps({
      markStripeEventProcessed: vi.fn().mockRejectedValue(new Error("db down")),
    });
    const event = makeEvent();

    const result = await handlePaymentIntentFailed(event as never, deps);

    expect(result).toMatchObject({ status: "notified", eventId: "evt_test456" });
    expect(logger.error).toHaveBeenCalledWith(
      "inngest.payment_intent_failed.mark_processed_error",
      expect.objectContaining({ eventId: "evt_test456", err: expect.any(Error) }),
    );
  });

  it("logs_error_fields_from_last_payment_error", async () => {
    const deps = makeDeps();
    const event = makeEvent({
      lastPaymentError: { code: "card_declined", decline_code: "insufficient_funds", message: "Funds low" },
    });

    await handlePaymentIntentFailed(event as never, deps);

    expect(logger.error).toHaveBeenCalledWith(
      "inngest.payment_intent_failed.start",
      expect.objectContaining({
        eventId: "evt_test456",
        paymentIntentId: "pi_test123",
        invoiceId: "inv-uuid-123",
        amount: 10000,
        errorCode: "card_declined",
        declineCode: "insufficient_funds",
        errorMessage: "Funds low",
      }),
    );
  });

  it("returns_logged_when_invoice_not_found", async () => {
    const deps = makeDeps({
      getInvoiceById: vi.fn().mockResolvedValue(null),
    });
    const event = makeEvent();

    const result = await handlePaymentIntentFailed(event as never, deps);

    expect(deps.dispatchNotification).not.toHaveBeenCalled();
    expect(deps.markStripeEventProcessed).toHaveBeenCalledWith("evt_test456");
    expect(result).toMatchObject({ status: "logged", eventId: "evt_test456" });
  });

  it("no_direct_service_imports", () => {
    const handlerPath = fileURLToPath(
      new URL("../payment-intent-failed.handler.ts", import.meta.url),
    );
    const content = readFileSync(handlerPath, "utf-8");
    expect(content).not.toMatch(/from ['"]@saas\/(services|workflows)['"]/);
  });

  it("no_inngest_sdk_mocks", () => {
    const testPath = fileURLToPath(
      new URL("./payment-intent-failed.handler.test.ts", import.meta.url),
    );
    const content = readFileSync(testPath, "utf-8");
    expect(content).not.toMatch(/vi\.mock\(['"]@saas\/workflows['"]/);
  });
});
