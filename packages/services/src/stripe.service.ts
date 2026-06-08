import Stripe from "stripe";

export class StripeServiceError extends Error {
  code: string;
  cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = "StripeServiceError";
    this.code = code;
    this.cause = cause;
  }
}

export type CreateCheckoutSessionParams =
  | {
      mode: "payment";
      invoiceId: string;
      customerId: string;
      amountEurCents: number;
      successUrl: string;
      cancelUrl: string;
      description?: string;
    }
  | {
      mode: "subscription";
      maintenanceContractId: string;
      customerId: string;
      priceId: string;
      successUrl: string;
      cancelUrl: string;
    };

let _stripeClient: Stripe | null = null;
let _stripeClientKey: string | null = null;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new StripeServiceError(
      "STRIPE_SECRET_KEY is not defined",
      "stripe/config_error"
    );
  }
  if (!_stripeClient || _stripeClientKey !== secretKey) {
    _stripeClient = new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
    _stripeClientKey = secretKey;
  }
  return _stripeClient;
}

export function __resetStripeClientForTests(): void {
  _stripeClient = null;
  _stripeClientKey = null;
}

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new StripeServiceError(
      "STRIPE_WEBHOOK_SECRET is not defined",
      "stripe/config_error"
    );
  }
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    if (err instanceof StripeServiceError) throw err;
    throw new StripeServiceError("Webhook signature verification failed", "stripe/invalid_signature", err);
  }
}

function wrapStripeError(err: unknown): StripeServiceError {
  if (err instanceof Stripe.errors.StripeError) {
    return new StripeServiceError(
      err.message,
      `stripe/${err.type}`,
      err
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return new StripeServiceError(message, "stripe/unknown_error", err);
}

export class StripeService {
  private get stripe(): Stripe {
    return getStripeClient();
  }

  async createCustomer(input: {
    email: string;
    name?: string;
    clientId?: string;
  }): Promise<Stripe.Customer> {
    const ctx = input.clientId ? { clientId: input.clientId } : {};
    console.info("[StripeService.createCustomer] start", ctx);
    try {
      const customer = await this.stripe.customers.create({
        email: input.email,
        ...(input.name && { name: input.name }),
        ...(input.clientId && { metadata: { clientId: input.clientId } }),
      });
      console.info("[StripeService.createCustomer] done", ctx);
      return customer;
    } catch (err) {
      const wrapped = wrapStripeError(err);
      console.error("[StripeService.createCustomer] error", {
        ...ctx,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async getCustomer(stripeCustomerId: string): Promise<Stripe.Customer | null> {
    console.info("[StripeService.getCustomer] start", { customerId: stripeCustomerId });
    try {
      const customer = await this.stripe.customers.retrieve(stripeCustomerId);
      if (customer.deleted) {
        console.info("[StripeService.getCustomer] done (not found)", { customerId: stripeCustomerId });
        return null;
      }
      console.info("[StripeService.getCustomer] done", { customerId: stripeCustomerId });
      return customer;
    } catch (err) {
      if (
        err instanceof Stripe.errors.StripeError &&
        err.statusCode === 404
      ) {
        console.info("[StripeService.getCustomer] done (not found)", { customerId: stripeCustomerId });
        return null;
      }
      const wrapped = wrapStripeError(err);
      console.error("[StripeService.getCustomer] error", {
        customerId: stripeCustomerId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<Stripe.Checkout.Session> {
    const logCtx =
      params.mode === "payment"
        ? { mode: params.mode, customerId: params.customerId, invoiceId: params.invoiceId }
        : { mode: params.mode, customerId: params.customerId, maintenanceContractId: params.maintenanceContractId };
    console.info("[StripeService.createCheckoutSession] start", logCtx);
    try {
      const sessionCreateParams: Stripe.Checkout.SessionCreateParams =
        params.mode === "subscription"
          ? {
              customer: params.customerId,
              mode: "subscription",
              line_items: [{ price: params.priceId, quantity: 1 }],
              success_url: params.successUrl,
              cancel_url: params.cancelUrl,
              metadata: { maintenanceContractId: params.maintenanceContractId, source: "maintenance" },
            }
          : {
              customer: params.customerId,
              mode: "payment",
              payment_method_types: ["card"],
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: "eur",
                    unit_amount: params.amountEurCents,
                    product_data: { name: params.description ?? "Payment" },
                  },
                },
              ],
              success_url: params.successUrl,
              cancel_url: params.cancelUrl,
              metadata: { invoiceId: params.invoiceId, source: "invoice" },
            };
      const session = await this.stripe.checkout.sessions.create(sessionCreateParams);
      if (!session.url) {
        throw new StripeServiceError(
          "Checkout session URL is missing",
          "stripe/missing_url"
        );
      }
      console.info("[StripeService.createCheckoutSession] done", logCtx);
      return session;
    } catch (err) {
      if (err instanceof StripeServiceError) throw err;
      const wrapped = wrapStripeError(err);
      console.error("[StripeService.createCheckoutSession] error", {
        ...logCtx,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async createPortalSession(
    stripeCustomerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    console.info("[StripeService.createPortalSession] start", { customerId: stripeCustomerId });
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      console.info("[StripeService.createPortalSession] done", { customerId: stripeCustomerId });
      return session;
    } catch (err) {
      const wrapped = wrapStripeError(err);
      console.error("[StripeService.createPortalSession] error", {
        customerId: stripeCustomerId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async cancelSubscription(
    stripeSubscriptionId: string
  ): Promise<Stripe.Subscription> {
    console.info("[StripeService.cancelSubscription] start", { subscriptionId: stripeSubscriptionId });
    try {
      const subscription = await this.stripe.subscriptions.update(
        stripeSubscriptionId,
        { cancel_at_period_end: true }
      );
      console.info("[StripeService.cancelSubscription] done", { subscriptionId: stripeSubscriptionId });
      return subscription;
    } catch (err) {
      const wrapped = wrapStripeError(err);
      console.error("[StripeService.cancelSubscription] error", {
        subscriptionId: stripeSubscriptionId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }
}

let _stripeService: StripeService | null = null;

export function getStripeService(): StripeService {
  if (_stripeService === null) {
    _stripeService = new StripeService();
  }
  return _stripeService;
}

export function __resetStripeServiceForTests(): void {
  _stripeService = null;
}
