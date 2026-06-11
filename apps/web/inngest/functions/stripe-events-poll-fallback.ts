import type Stripe from "stripe";
import { inngest } from "@saas/workflows";
import {
  getStripeClient,
  getStripeEvent,
  recordStripeEvent,
  getInvoiceById,
  paymentService,
  markStripeEventProcessed,
  dispatchNotification,
} from "@saas/services";
import { logger } from "@saas/services/logger";
import { handlePaymentIntentSucceeded } from "./payment-intent-succeeded.handler";
import { handlePaymentIntentFailed } from "./payment-intent-failed.handler";

export const POLL_LOOKBACK_HOURS = 25;

export const stripeEventsPollFallbackCron = inngest.createFunction(
  { id: "stripe-events-poll-fallback-cron", retries: 3 },
  { cron: "0 * * * *" },
  async () => {
    logger.info("inngest.cron.payment_intent_poll_fallback.start", { jobName: "payment_intent_poll_fallback" });

    const cutoff = Math.floor(Date.now() / 1000) - POLL_LOOKBACK_HOURS * 3600;
    const stripe = getStripeClient();

    let totalScanned = 0;
    let alreadyProcessed = 0;
    let reInjected = 0;
    let skippedNoInvoiceId = 0;
    let failedScanned = 0;
    let failedAlreadyProcessed = 0;
    let failedReInjected = 0;

    for await (const ev of stripe.events.list({
      type: "payment_intent.succeeded",
      created: { gte: cutoff },
    })) {
      totalScanned++;

      const existing = await getStripeEvent(ev.id);

      if (existing?.processedAt != null) {
        alreadyProcessed++;
        continue;
      }

      const paymentIntent = ev.data.object as Stripe.PaymentIntent;

      if (!paymentIntent.metadata?.invoiceId) {
        if (!existing) {
          await recordStripeEvent({ eventId: ev.id, type: ev.type, payload: ev });
        }
        skippedNoInvoiceId++;
        continue;
      }

      if (!existing) {
        await recordStripeEvent({ eventId: ev.id, type: ev.type, payload: ev });
      }

      await handlePaymentIntentSucceeded(
        { data: { event: ev } },
        {
          getInvoiceById,
          createPayment: paymentService.createPayment,
          markStripeEventProcessed,
        },
      );
      reInjected++;
    }

    for await (const ev of stripe.events.list({
      type: "payment_intent.failed",
      created: { gte: cutoff },
    })) {
      failedScanned++;

      const existing = await getStripeEvent(ev.id);

      if (existing?.processedAt != null) {
        failedAlreadyProcessed++;
        continue;
      }

      if (!existing) {
        await recordStripeEvent({ eventId: ev.id, type: ev.type, payload: ev });
      }

      await handlePaymentIntentFailed(
        { data: { event: ev } },
        {
          getInvoiceById,
          dispatchNotification,
          markStripeEventProcessed,
        },
      );
      failedReInjected++;
    }

    logger.info("inngest.cron.payment_intent_poll_fallback.completed", {
      jobName: "payment_intent_poll_fallback",
      totalScanned,
      alreadyProcessed,
      reInjected,
      skippedNoInvoiceId,
      failedScanned,
      failedAlreadyProcessed,
      failedReInjected,
    });

    return {
      status: "completed",
      totalScanned,
      alreadyProcessed,
      reInjected,
      skippedNoInvoiceId,
      failedScanned,
      failedAlreadyProcessed,
      failedReInjected,
    };
  },
);
