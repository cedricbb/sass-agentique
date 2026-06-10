import type Stripe from "stripe";
import { inngest } from "@saas/workflows";
import { markStripeEventProcessed, getInvoiceById, dispatchNotification } from "@saas/services";

export const paymentIntentFailedHandler = inngest.createFunction(
  { id: "stripe-payment-intent-failed", retries: 3 },
  { event: "stripe/payment-intent.failed" },
  async ({ event }) => {
    const stripeEvent = event.data.event as Stripe.Event;
    const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;

    console.error(JSON.stringify({
      event: "stripe-payment-intent-failed",
      outcome: "logged",
      eventId: stripeEvent.id,
      paymentIntentId: paymentIntent.id,
      invoiceId: paymentIntent.metadata?.invoiceId ?? null,
      amount: paymentIntent.amount,
      errorCode: paymentIntent.last_payment_error?.code ?? null,
      declineCode: paymentIntent.last_payment_error?.decline_code ?? null,
      errorMessage: paymentIntent.last_payment_error?.message ?? null,
    }));

    const invoiceId = paymentIntent.metadata?.invoiceId;
    let status: "logged" | "notified" = "logged";

    if (invoiceId) {
      try {
        const invoice = await getInvoiceById(invoiceId);
        if (invoice) {
          await dispatchNotification("payment.failed", { invoiceId, tenantId: invoice.ownerId });
          status = "notified";
        }
      } catch (err) {
        console.error(JSON.stringify({
          event: "stripe-payment-intent-failed",
          outcome: "notification_error",
          eventId: stripeEvent.id,
          message: (err as Error).message,
        }));
      }
    }

    try {
      await markStripeEventProcessed(stripeEvent.id);
    } catch (err) {
      console.error(JSON.stringify({
        event: "stripe-payment-intent-failed",
        outcome: "mark_processed_error",
        eventId: stripeEvent.id,
        message: (err as Error).message,
      }));
    }

    return { status, eventId: stripeEvent.id };
  }
);
