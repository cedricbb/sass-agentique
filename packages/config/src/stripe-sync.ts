import { PLANS, type PlanConfig } from "./plans";

export interface StripeProduct {
  id: string;
  name: string;
  metadata: Record<string, string>;
}

export interface StripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
  metadata: Record<string, string>;
}

type BillingInterval = "day" | "week" | "month" | "year";

export interface StripeClient {
  products: {
    list(params: { limit: number }): Promise<{ data: StripeProduct[] }>;
    create(params: {
      name: string;
      metadata: Record<string, string>;
    }): Promise<StripeProduct>;
    update(
      id: string,
      params: { name: string; metadata: Record<string, string> }
    ): Promise<StripeProduct>;
  };
  prices: {
    list(params: { product: string; active: boolean }): Promise<{
      data: StripePrice[];
    }>;
    create(params: {
      product: string;
      currency: string;
      unit_amount: number;
      recurring: { interval: BillingInterval };
      metadata: Record<string, string>;
    }): Promise<StripePrice>;
  };
}

export interface StripeSyncResult {
  slug: string;
  productId: string;
  action: "created" | "updated";
  monthlyPriceId: string;
  yearlyPriceId: string;
}

function findExistingPrice(
  prices: StripePrice[],
  interval: BillingInterval,
  unitAmount: number
): StripePrice | undefined {
  return prices.find(
    (p) =>
      p.recurring?.interval === interval &&
      p.unit_amount === unitAmount &&
      p.currency === "eur"
  );
}

async function upsertStripeProduct(
  stripe: StripeClient,
  plan: PlanConfig
): Promise<{ product: StripeProduct; action: "created" | "updated" }> {
  const metadata = { planId: plan.id };

  if (plan.stripeProductId) {
    const product = await stripe.products.update(plan.stripeProductId, {
      name: plan.name,
      metadata,
    });
    return { product, action: "updated" };
  }

  const { data: existing } = await stripe.products.list({ limit: 100 });
  const found = existing.find((p) => p.metadata.planId === plan.id);

  if (found) {
    const product = await stripe.products.update(found.id, {
      name: plan.name,
      metadata,
    });
    return { product, action: "updated" };
  }

  const product = await stripe.products.create({
    name: plan.name,
    metadata,
  });
  return { product, action: "created" };
}

async function ensureStripePrice(
  stripe: StripeClient,
  productId: string,
  interval: BillingInterval,
  amount: number,
  planId: string
): Promise<string> {
  const existingPrices = await stripe.prices.list({
    product: productId,
    active: true,
  });

  const existing = findExistingPrice(existingPrices.data, interval, amount);
  if (existing) return existing.id;

  const created = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: amount,
    recurring: { interval },
    metadata: { planId },
  });
  return created.id;
}

export async function syncPlansToStripe(
  stripe: StripeClient,
  plansOverride?: Record<string, PlanConfig>
): Promise<StripeSyncResult[]> {
  const plansToSync = plansOverride ?? PLANS;
  const results: StripeSyncResult[] = [];

  for (const plan of Object.values(plansToSync)) {
    if (plan.id === "free") continue;

    const { product, action } = await upsertStripeProduct(stripe, plan);

    const monthlyPriceId = await ensureStripePrice(
      stripe, product.id, "month", plan.pricing.monthlyEurCents, plan.id
    );
    const yearlyPriceId = await ensureStripePrice(
      stripe, product.id, "year", plan.pricing.yearlyEurCents, plan.id
    );

    results.push({
      slug: plan.slug,
      productId: product.id,
      action,
      monthlyPriceId,
      yearlyPriceId,
    });
  }

  return results;
}
