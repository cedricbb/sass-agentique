import type Stripe from "stripe";
import { inngest } from "@saas/workflows";
import { markStripeEventProcessed } from "@saas/services";

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

    return { status: "logged" as const, eventId: stripeEvent.id };
  }
);
