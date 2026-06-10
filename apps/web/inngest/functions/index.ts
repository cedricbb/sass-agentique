import { paymentIntentSucceededHandler } from "./payment-intent-succeeded";
import { paymentIntentFailedHandler } from "./payment-intent-failed";
import { stripeEventsRetentionCron } from "./stripe-events-retention";
import { stripeEventsPollFallbackCron } from "./stripe-events-poll-fallback";

export const inngestFunctions = [
  paymentIntentSucceededHandler,
  paymentIntentFailedHandler,
  stripeEventsRetentionCron,
  stripeEventsPollFallbackCron,
] as const;
