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

export interface StripeCustomer {
  stripeCustomerId: string;
  tenantId: string;
  email: string;
  name: string;
}

export interface CheckoutSessionParamsBase {
  successUrl: string;
  cancelUrl: string;
  stripeCustomerId: string;
  clientReferenceId: string;
}

export interface CheckoutSessionSubscription extends CheckoutSessionParamsBase {
  mode: "subscription";
  priceId: string;
}

export interface CheckoutSessionPayment extends CheckoutSessionParamsBase {
  mode: "payment";
  productId: string;
  unitAmountCents: number;
}

export type CheckoutSessionParams = CheckoutSessionSubscription | CheckoutSessionPayment;

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface PortalSession {
  url: string;
}

export interface CancelledSubscription {
  stripeSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
}

function buildStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new StripeServiceError(
      "STRIPE_SECRET_KEY is not defined",
      "stripe/config_error"
    );
  }
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" });
}

function wrapStripeError(err: unknown, method: string): StripeServiceError {
  if (err instanceof Stripe.errors.StripeError) {
    return new StripeServiceError(
      err.message,
      `stripe/${err.type}`,
      err
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return new StripeServiceError(message, `stripe/unknown_error`, err);
}

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = buildStripeClient();
  }

  async createCustomer(
    tenantId: string,
    email: string,
    name: string
  ): Promise<StripeCustomer> {
    console.info("[StripeService.createCustomer] start", { tenantId });
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: { tenantId },
      });
      console.info("[StripeService.createCustomer] done", { tenantId });
      return {
        stripeCustomerId: customer.id,
        tenantId,
        email: customer.email ?? email,
        name: customer.name ?? name,
      };
    } catch (err) {
      const wrapped = wrapStripeError(err, "createCustomer");
      console.error("[StripeService.createCustomer] error", {
        tenantId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async getCustomer(
    tenantId: string,
    stripeCustomerId: string
  ): Promise<StripeCustomer | null> {
    console.info("[StripeService.getCustomer] start", { tenantId });
    try {
      const customer = await this.stripe.customers.retrieve(stripeCustomerId);
      if (customer.deleted) {
        console.info("[StripeService.getCustomer] done (not found)", {
          tenantId,
        });
        return null;
      }
      console.info("[StripeService.getCustomer] done", { tenantId });
      return {
        stripeCustomerId: customer.id,
        tenantId,
        email: customer.email ?? "",
        name: customer.name ?? "",
      };
    } catch (err) {
      if (
        err instanceof Stripe.errors.StripeError &&
        err.statusCode === 404
      ) {
        console.info("[StripeService.getCustomer] done (not found)", {
          tenantId,
        });
        return null;
      }
      const wrapped = wrapStripeError(err, "getCustomer");
      console.error("[StripeService.getCustomer] error", {
        tenantId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async createCheckoutSession(
    tenantId: string,
    params: CheckoutSessionParams
  ): Promise<CheckoutSession> {
    console.info("[StripeService.createCheckoutSession] start", { tenantId });
    try {
      const session = await this.stripe.checkout.sessions.create(
        params.mode === "subscription"
          ? {
              customer: params.stripeCustomerId,
              client_reference_id: params.clientReferenceId,
              mode: "subscription",
              line_items: [{ price: params.priceId, quantity: 1 }],
              success_url: params.successUrl,
              cancel_url: params.cancelUrl,
              metadata: { tenantId: params.clientReferenceId },
            }
          : {
              customer: params.stripeCustomerId,
              client_reference_id: params.clientReferenceId,
              mode: "payment",
              payment_method_types: ["card"],
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: "eur",
                    product: params.productId,
                    unit_amount: params.unitAmountCents,
                  },
                },
              ],
              success_url: params.successUrl,
              cancel_url: params.cancelUrl,
              metadata: { tenantId: params.clientReferenceId },
            }
      );
      if (!session.url) {
        throw new StripeServiceError(
          "Checkout session URL is missing",
          "stripe/missing_url"
        );
      }
      console.info("[StripeService.createCheckoutSession] done", { tenantId });
      return { sessionId: session.id, url: session.url };
    } catch (err) {
      if (err instanceof StripeServiceError) throw err;
      const wrapped = wrapStripeError(err, "createCheckoutSession");
      console.error("[StripeService.createCheckoutSession] error", {
        tenantId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async createPortalSession(
    tenantId: string,
    stripeCustomerId: string,
    returnUrl: string
  ): Promise<PortalSession> {
    console.info("[StripeService.createPortalSession] start", { tenantId });
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      console.info("[StripeService.createPortalSession] done", { tenantId });
      return { url: session.url };
    } catch (err) {
      const wrapped = wrapStripeError(err, "createPortalSession");
      console.error("[StripeService.createPortalSession] error", {
        tenantId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }

  async cancelSubscription(
    tenantId: string,
    stripeSubscriptionId: string
  ): Promise<CancelledSubscription> {
    console.info("[StripeService.cancelSubscription] start", { tenantId });
    try {
      const subscription = await this.stripe.subscriptions.update(
        stripeSubscriptionId,
        { cancel_at_period_end: true }
      );
      console.info("[StripeService.cancelSubscription] done", { tenantId });
      return {
        stripeSubscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };
    } catch (err) {
      const wrapped = wrapStripeError(err, "cancelSubscription");
      console.error("[StripeService.cancelSubscription] error", {
        tenantId,
        error: wrapped.message,
      });
      throw wrapped;
    }
  }
}
