import { inngest } from "@saas/workflows";
import { getInvoiceById, paymentService, markStripeEventProcessed } from "@saas/services";
import { handlePaymentIntentSucceeded } from "./payment-intent-succeeded.handler";

export const paymentIntentSucceededHandler = inngest.createFunction(
  { id: "stripe-payment-intent-succeeded", retries: 3 },
  { event: "stripe/payment-intent.succeeded" },
  async ({ event, step }) => {
    return step.run("handle-payment-intent-succeeded", () =>
      handlePaymentIntentSucceeded({ data: event.data }, {
        getInvoiceById,
        createPayment: paymentService.createPayment,
        markStripeEventProcessed,
      }),
    );
  },
);
