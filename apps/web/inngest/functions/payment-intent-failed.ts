import { inngest } from "@saas/workflows";
import { getInvoiceById, dispatchNotification, markStripeEventProcessed } from "@saas/services";
import { handlePaymentIntentFailed } from "./payment-intent-failed.handler";

export const paymentIntentFailedHandler = inngest.createFunction(
  { id: "stripe-payment-intent-failed", retries: 3 },
  { event: "stripe/payment-intent.failed" },
  async ({ event, step }) => {
    return step.run("handle-payment-intent-failed", () =>
      handlePaymentIntentFailed({ data: event.data }, {
        getInvoiceById,
        dispatchNotification,
        markStripeEventProcessed,
      }),
    );
  },
);
