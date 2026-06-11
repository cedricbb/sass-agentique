import type Stripe from "stripe";
import { logger } from "@saas/services/logger";

export type PaymentIntentFailedDeps = {
  getInvoiceById: (id: string) => Promise<{ id: string; ownerId: string } | null>;
  dispatchNotification: (
    event: "payment.failed",
    payload: { invoiceId: string; tenantId: string },
  ) => Promise<void>;
  markStripeEventProcessed: (eventId: string) => Promise<unknown>;
};

export type PaymentIntentFailedResult =
  | { status: "logged"; eventId: string }
  | { status: "notified"; eventId: string; invoiceId: string };

export async function handlePaymentIntentFailed(
  event: { data: { event: Stripe.Event } },
  deps: PaymentIntentFailedDeps,
): Promise<PaymentIntentFailedResult> {
  const stripeEvent = event.data.event;
  const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;

  logger.error("inngest.payment_intent_failed.start", {
    eventId: stripeEvent.id,
    paymentIntentId: paymentIntent.id,
    invoiceId: paymentIntent.metadata?.invoiceId ?? null,
    amount: paymentIntent.amount,
    errorCode: paymentIntent.last_payment_error?.code ?? null,
    declineCode: paymentIntent.last_payment_error?.decline_code ?? null,
    errorMessage: paymentIntent.last_payment_error?.message ?? null,
  });

  const invoiceId = paymentIntent.metadata?.invoiceId;
  let status: "logged" | "notified" = "logged";
  let notifiedInvoiceId: string | undefined;

  if (invoiceId) {
    try {
      const invoice = await deps.getInvoiceById(invoiceId);
      if (invoice) {
        await deps.dispatchNotification("payment.failed", { invoiceId, tenantId: invoice.ownerId });
        status = "notified";
        notifiedInvoiceId = invoiceId;
      }
    } catch (err) {
      logger.error("inngest.payment_intent_failed.notification_error", {
        eventId: stripeEvent.id,
        err,
      });
    }
  }

  try {
    await deps.markStripeEventProcessed(stripeEvent.id);
  } catch (err) {
    logger.error("inngest.payment_intent_failed.mark_processed_error", {
      eventId: stripeEvent.id,
      err,
    });
  }

  if (status === "notified" && notifiedInvoiceId) {
    return { status: "notified", eventId: stripeEvent.id, invoiceId: notifiedInvoiceId };
  }
  return { status: "logged", eventId: stripeEvent.id };
}
