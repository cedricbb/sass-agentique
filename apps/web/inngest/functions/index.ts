import { paymentIntentSucceededHandler } from "./payment-intent-succeeded";
import { paymentIntentFailedHandler } from "./payment-intent-failed";

export const inngestFunctions = [
  paymentIntentSucceededHandler,
  paymentIntentFailedHandler,
] as const;
