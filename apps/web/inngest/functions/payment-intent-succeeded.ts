import type Stripe from "stripe";
import { inngest } from "@saas/workflows";
import { getInvoiceById, paymentService, markStripeEventProcessed } from "@saas/services";

export const paymentIntentSucceededHandler = inngest.createFunction(
  { id: "stripe-payment-intent-succeeded", retries: 3 },
  { event: "stripe/payment-intent.succeeded" },
  async ({ event, step }) => {
    const stripeEvent = event.data.event as Stripe.Event;
    const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;

    const invoiceId = paymentIntent.metadata?.invoiceId;

    if (!invoiceId || paymentIntent.amount <= 0) {
      await markStripeEventProcessed(stripeEvent.id);
      const reason = !invoiceId ? "no_invoice_id_metadata" : "invalid_amount";
      return { status: "skipped" as const, reason, eventId: stripeEvent.id };
    }

    const invoice = await step.run("get-invoice", () => getInvoiceById(invoiceId));

    if (!invoice) {
      console.error(JSON.stringify({
        event: "stripe-payment-intent-succeeded",
        outcome: "invoice_not_found",
        eventId: stripeEvent.id,
        invoiceId,
      }));
      await markStripeEventProcessed(stripeEvent.id);
      return { status: "skipped" as const, reason: "invoice_not_found", invoiceId };
    }

    const { invoiceMarkedAsPaid } = await step.run("create-payment", () =>
      paymentService.createPayment({
        invoiceId,
        ownerId: invoice.ownerId,
        amountEurCents: paymentIntent.amount,
        method: "stripe_card",
        externalRef: paymentIntent.id,
        paidAt: new Date(paymentIntent.created * 1000),
      })
    );

    try {
      await markStripeEventProcessed(stripeEvent.id);
    } catch (err) {
      console.error(JSON.stringify({
        event: "stripe-payment-intent-succeeded",
        outcome: "mark_processed_failed",
        eventId: stripeEvent.id,
        invoiceId,
        error: err instanceof Error ? err.message : String(err),
      }));
    }

    return { status: "processed" as const, invoiceId, paymentIntentId: paymentIntent.id, invoiceMarkedAsPaid };
  }
);
