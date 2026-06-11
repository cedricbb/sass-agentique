import { inngest } from "@saas/workflows";
import { deleteStaleStripeEvents, STRIPE_EVENTS_RETENTION_DAYS } from "@saas/services";
import { logger } from "@saas/services/logger";

export const stripeEventsRetentionCron = inngest.createFunction(
  { id: "stripe-events-retention-cron" },
  { cron: "0 3 * * *" },
  async () => {
    logger.info("inngest.cron.stripe_events_retention.start", {
      jobName: "stripe_events_retention",
      retentionDays: STRIPE_EVENTS_RETENTION_DAYS,
    });
    try {
      const { deletedCount } = await deleteStaleStripeEvents(STRIPE_EVENTS_RETENTION_DAYS);
      logger.info("inngest.cron.stripe_events_retention.purged", {
        jobName: "stripe_events_retention",
        purgedCount: deletedCount,
      });
      return { status: "completed", deletedCount };
    } catch (err) {
      logger.error("inngest.cron.stripe_events_retention.error", {
        jobName: "stripe_events_retention",
        err,
      });
      throw err;
    }
  }
);
