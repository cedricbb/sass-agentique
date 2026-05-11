import Stripe from "stripe";
import { PLANS, type PlanConfig } from "@saas/config";
import { syncPlansToStripe, type StripeSyncResult } from "@saas/config";
import { db } from "@saas/db";
import { plans } from "@saas/db";
import { eq } from "drizzle-orm";

export function planToDbRow(plan: PlanConfig, stripeResult?: StripeSyncResult) {
  return {
    slug: plan.slug,
    name: plan.name,
    stripeProductId: stripeResult?.productId ?? null,
    stripePriceIdMonthly: stripeResult?.monthlyPriceId ?? null,
    stripePriceIdYearly: stripeResult?.yearlyPriceId ?? null,
    priceMonthlyEurCents: plan.pricing.monthlyEurCents,
    priceYearlyEurCents: plan.pricing.yearlyEurCents,
    features: {
      ...plan.limits,
      ...plan.features,
    },
    sortOrder: plan.sortOrder,
    isActive: true,
  };
}

export async function syncPlansToDb(stripeResults: StripeSyncResult[]) {
  const results: { slug: string; action: "inserted" | "updated" }[] = [];
  const stripeBySlug = new Map(stripeResults.map((r) => [r.slug, r]));

  for (const plan of Object.values(PLANS)) {
    const row = planToDbRow(plan, stripeBySlug.get(plan.slug));
    const existing = await db.select().from(plans).where(eq(plans.slug, plan.slug)).limit(1);

    if (existing.length > 0) {
      await db.update(plans).set(row).where(eq(plans.slug, plan.slug));
      results.push({ slug: plan.slug, action: "updated" });
    } else {
      await db.insert(plans).values(row);
      results.push({ slug: plan.slug, action: "inserted" });
    }
  }

  return results;
}

function buildStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not defined");
  }
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" });
}

if (process.argv[1]?.endsWith("stripe-sync.ts") || process.argv[1]?.endsWith("stripe-sync")) {
  const stripe = buildStripeClient();

  Promise.resolve()
    .then(async () => {
      console.info("[stripe-sync] Syncing products and prices to Stripe...");
      const stripeResults = await syncPlansToStripe(stripe);
      for (const r of stripeResults) {
        console.info(`[stripe-sync] ${r.action}: ${r.slug} (product=${r.productId})`);
      }

      console.info("[stripe-sync] Syncing plans to database...");
      const dbResults = await syncPlansToDb(stripeResults);
      for (const r of dbResults) {
        console.info(`[stripe-sync] ${r.action}: ${r.slug}`);
      }

      console.info("[stripe-sync] Stripe plans sync complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[stripe-sync] Sync failed:", err);
      process.exit(1);
    });
}
