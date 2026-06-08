import { paymentIntentSucceededHandler } from "./payment-intent-succeeded";
import { paymentIntentFailedHandler } from "./payment-intent-failed";
import { stripeEventsRetentionCron } from "./stripe-events-retention";

export const inngestFunctions = [
  paymentIntentSucceededHandler,
  paymentIntentFailedHandler,
  stripeEventsRetentionCron,
] as const;
