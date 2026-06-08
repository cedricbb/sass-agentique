import { inngest } from "@saas/workflows";
import { deleteStaleStripeEvents, STRIPE_EVENTS_RETENTION_DAYS } from "@saas/services";

export const stripeEventsRetentionCron = inngest.createFunction(
  { id: "stripe-events-retention-cron" },
  { cron: "0 3 * * *" },
  async () => {
    const { deletedCount } = await deleteStaleStripeEvents(STRIPE_EVENTS_RETENTION_DAYS);
    return { status: "completed", deletedCount };
  }
);
