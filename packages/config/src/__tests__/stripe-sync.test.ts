import { describe, it, expect, vi } from "vitest";
import type { StripeClient, StripeProduct, StripePrice, StripeSyncResult } from "../stripe-sync";
import { syncPlansToStripe } from "../stripe-sync";
import type { PlanConfig } from "../plans";

function makePlan(overrides: Partial<PlanConfig> = {}): PlanConfig {
  return {
    id: "pro",
    slug: "pro",
    name: "Pro",
    sortOrder: 1,
    pricing: { monthlyEurCents: 2900, yearlyEurCents: 29000, yearlyDiscountPercent: 17 },
    limits: { maxMembers: 10, maxContacts: 5000, maxAgentTasksPerMonth: 200, maxEmailsPerMonth: 5000, storageMb: 5120, maxActiveWorkflows: 5 },
    features: { hasTwoFactor: true, hasAdminBackoffice: true, hasAiAgents: true, hasWorkflows: true, hasCustomDomain: false, hasWhiteLabel: false, hasAdvancedAnalytics: false, hasPrioritySupport: true, hasSla: false, hasDataExport: true },
    stripeProductId: null,
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
    ...overrides,
  };
}

function makeProduct(id: string, metadata: Record<string, string> = {}): StripeProduct {
  return { id, name: "Test", metadata };
}

function makePrice(id: string, interval: string, amount: number): StripePrice {
  return { id, unit_amount: amount, currency: "eur", recurring: { interval }, metadata: {} };
}

function buildMockStripe(existingProducts: StripeProduct[] = [], existingPrices: StripePrice[] = []): StripeClient {
  let priceCounter = 0;
  return {
    products: {
      list: vi.fn().mockResolvedValue({ data: existingProducts }),
      create: vi.fn().mockImplementation(async (params) =>
        makeProduct("prod_new_" + params.metadata.planId, params.metadata)
      ),
      update: vi.fn().mockImplementation(async (id, params) =>
        makeProduct(id, params.metadata)
      ),
    },
    prices: {
      list: vi.fn().mockResolvedValue({ data: existingPrices }),
      create: vi.fn().mockImplementation(async (params) => {
        priceCounter++;
        return makePrice("price_new_" + priceCounter, params.recurring.interval, params.unit_amount);
      }),
    },
  };
}

describe("syncPlansToStripe", () => {
  it("skips free plan", async () => {
    const stripe = buildMockStripe();
    const plans = { free: makePlan({ id: "free", slug: "free", name: "Free" }) };
    const results = await syncPlansToStripe(stripe, plans);
    expect(results).toEqual([]);
    expect(stripe.products.create).not.toHaveBeenCalled();
  });

  it("creates product when no stripeProductId and no existing product in Stripe", async () => {
    const stripe = buildMockStripe();
    const plans = { pro: makePlan() };
    const results = await syncPlansToStripe(stripe, plans);

    expect(stripe.products.list).toHaveBeenCalledWith({ limit: 100 });
    expect(stripe.products.create).toHaveBeenCalledWith({
      name: "Pro",
      metadata: { planId: "pro" },
    });
    expect(results).toHaveLength(1);
    expect(results[0].productId).toBe("prod_new_pro");
    expect(results[0].action).toBe("created");
  });

  it("finds existing product by metadata.planId when stripeProductId is null", async () => {
    const existingProduct = makeProduct("prod_existing_123", { planId: "pro" });
    const stripe = buildMockStripe([existingProduct]);
    const plans = { pro: makePlan() };
    const results = await syncPlansToStripe(stripe, plans);

    expect(stripe.products.list).toHaveBeenCalledWith({ limit: 100 });
    expect(stripe.products.update).toHaveBeenCalledWith("prod_existing_123", {
      name: "Pro",
      metadata: { planId: "pro" },
    });
    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(results[0].productId).toBe("prod_existing_123");
    expect(results[0].action).toBe("updated");
  });

  it("updates product directly when stripeProductId is set", async () => {
    const stripe = buildMockStripe();
    const plans = { pro: makePlan({ stripeProductId: "prod_env_456" }) };
    const results = await syncPlansToStripe(stripe, plans);

    expect(stripe.products.list).not.toHaveBeenCalled();
    expect(stripe.products.update).toHaveBeenCalledWith("prod_env_456", {
      name: "Pro",
      metadata: { planId: "pro" },
    });
    expect(results[0].productId).toBe("prod_env_456");
    expect(results[0].action).toBe("updated");
  });

  it("returns real Stripe price IDs in results", async () => {
    const stripe = buildMockStripe();
    const plans = { pro: makePlan() };
    const results = await syncPlansToStripe(stripe, plans);

    expect(results[0].monthlyPriceId).toMatch(/^price_new_/);
    expect(results[0].yearlyPriceId).toMatch(/^price_new_/);
  });

  it("syncs multiple non-free plans", async () => {
    const stripe = buildMockStripe();
    const plans = {
      free: makePlan({ id: "free", slug: "free", name: "Free" }),
      pro: makePlan({ id: "pro", slug: "pro", name: "Pro" }),
      business: makePlan({ id: "business" as any, slug: "business" as any, name: "Business", pricing: { monthlyEurCents: 9900, yearlyEurCents: 99000, yearlyDiscountPercent: 17 } }),
    };
    const results = await syncPlansToStripe(stripe, plans);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.slug)).toEqual(["pro", "business"]);
    expect(stripe.products.create).toHaveBeenCalledTimes(2);
  });

  it("creates prices with correct currency and params", async () => {
    const stripe = buildMockStripe();
    const plans = { pro: makePlan({ pricing: { monthlyEurCents: 2900, yearlyEurCents: 29000, yearlyDiscountPercent: 17 } }) };
    await syncPlansToStripe(stripe, plans);

    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "eur", unit_amount: 2900, recurring: { interval: "month" }, metadata: { planId: "pro" } })
    );
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "eur", unit_amount: 29000, recurring: { interval: "year" }, metadata: { planId: "pro" } })
    );
  });

  it("creates new price when existing price has different amount", async () => {
    const existingProduct = makeProduct("prod_x", { planId: "pro" });
    const existingPrices = [
      makePrice("price_old_month", "month", 1900),
      makePrice("price_old_year", "year", 19000),
    ];
    const stripe = buildMockStripe([existingProduct], existingPrices);
    const plans = { pro: makePlan({ pricing: { monthlyEurCents: 2900, yearlyEurCents: 29000, yearlyDiscountPercent: 17 } }) };
    const results = await syncPlansToStripe(stripe, plans);

    expect(stripe.prices.create).toHaveBeenCalledTimes(2);
    expect(results[0].monthlyPriceId).toMatch(/^price_new_/);
    expect(results[0].yearlyPriceId).toMatch(/^price_new_/);
  });

  it("calls prices.list with product id and active:true", async () => {
    const stripe = buildMockStripe();
    const plans = { pro: makePlan() };
    await syncPlansToStripe(stripe, plans);

    expect(stripe.prices.list).toHaveBeenCalledWith({ product: "prod_new_pro", active: true });
  });

  it("result contains correct slug", async () => {
    const stripe = buildMockStripe();
    const plans = { pro: makePlan({ slug: "pro", name: "Pro Plan" }) };
    const results = await syncPlansToStripe(stripe, plans);

    expect(results[0].slug).toBe("pro");
    expect(results[0].action).toBe("created");
    expect(results[0].monthlyPriceId).toBeDefined();
    expect(results[0].yearlyPriceId).toBeDefined();
  });

  it("idempotent: double execution does not create duplicate products", async () => {
    const existingProduct = makeProduct("prod_existing_123", { planId: "pro" });
    const existingPrices = [
      makePrice("price_month_1", "month", 2900),
      makePrice("price_year_1", "year", 29000),
    ];
    const stripe = buildMockStripe([existingProduct], existingPrices);
    const plans = { pro: makePlan() };

    const results = await syncPlansToStripe(stripe, plans);

    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(results[0].monthlyPriceId).toBe("price_month_1");
    expect(results[0].yearlyPriceId).toBe("price_year_1");
  });
});
