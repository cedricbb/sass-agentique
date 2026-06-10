import type Stripe from "stripe";

export type PaymentIntentSucceededDeps = {
  getInvoiceById: (id: string) => Promise<{ id: string; ownerId: string } | null>;
  createPayment: (input: NewPaymentInput) => Promise<{ payment: unknown; invoiceMarkedAsPaid: boolean }>;
  markStripeEventProcessed: (eventId: string) => Promise<unknown>;
};

type NewPaymentInput = {
  invoiceId: string;
  ownerId: string;
  amountEurCents: number;
  method: string;
  externalRef: string;
  paidAt: Date;
};

export type PaymentIntentResult =
  | {
      status: "skipped";
      reason: "no_invoice_id_metadata" | "invalid_amount" | "invoice_not_found";
      eventId?: string;
      invoiceId?: string;
    }
  | { status: "processed"; invoiceId: string; paymentIntentId: string; invoiceMarkedAsPaid: boolean };

export async function handlePaymentIntentSucceeded(
  event: { data: { event: Stripe.Event } },
  deps: PaymentIntentSucceededDeps,
): Promise<PaymentIntentResult> {
  const stripeEvent = event.data.event;
  const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;

  const invoiceId = paymentIntent.metadata?.invoiceId;

  if (!invoiceId || paymentIntent.amount <= 0) {
    await deps.markStripeEventProcessed(stripeEvent.id);
    const reason = !invoiceId ? ("no_invoice_id_metadata" as const) : ("invalid_amount" as const);
    return { status: "skipped", reason, eventId: stripeEvent.id };
  }

  const invoice = await deps.getInvoiceById(invoiceId);

  if (!invoice) {
    console.error(
      JSON.stringify({
        event: "stripe-payment-intent-succeeded",
        outcome: "invoice_not_found",
        eventId: stripeEvent.id,
        invoiceId,
      }),
    );
    await deps.markStripeEventProcessed(stripeEvent.id);
    return { status: "skipped", reason: "invoice_not_found", invoiceId };
  }

  const { invoiceMarkedAsPaid } = await deps.createPayment({
    invoiceId,
    ownerId: invoice.ownerId,
    amountEurCents: paymentIntent.amount,
    method: "stripe_card",
    externalRef: paymentIntent.id,
    paidAt: new Date(paymentIntent.created * 1000),
  });

  try {
    await deps.markStripeEventProcessed(stripeEvent.id);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "stripe-payment-intent-succeeded",
        outcome: "mark_processed_failed",
        eventId: stripeEvent.id,
        invoiceId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return { status: "processed", invoiceId, paymentIntentId: paymentIntent.id, invoiceMarkedAsPaid };
}
