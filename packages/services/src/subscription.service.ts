import { eq, or, gt, and, lt } from "drizzle-orm";
import {
  db,
  plans,
  subscriptions,
  type Plan,
  type Subscription,
  type SubscriptionStatus,
} from "@saas/db";

export class SubscriptionNotFoundError extends Error {
  tenantId: string;

  constructor(tenantId: string) {
    super(`No subscription found for tenantId: ${tenantId}`);
    this.name = "SubscriptionNotFoundError";
    this.tenantId = tenantId;
  }
}

export interface StripeSubscriptionEvent {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export class SubscriptionService {
  async getByTenantId(tenantId: string): Promise<Subscription | null> {
    console.info("[SubscriptionService.getByTenantId] start", { tenantId });
    try {
      const rows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);
      const result = rows[0] ?? null;
      console.info("[SubscriptionService.getByTenantId] done", { tenantId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SubscriptionService.getByTenantId] error", {
        tenantId,
        error: message,
      });
      throw err;
    }
  }

  async getActivePlan(tenantId: string): Promise<Plan | null> {
    console.info("[SubscriptionService.getActivePlan] start", { tenantId });
    try {
      const rows = await db
        .select({ plan: plans })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.tenantId, tenantId))
        .limit(1);
      const result = rows[0]?.plan ?? null;
      console.info("[SubscriptionService.getActivePlan] done", { tenantId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SubscriptionService.getActivePlan] error", {
        tenantId,
        error: message,
      });
      throw err;
    }
  }

  async upsertFromStripeEvent(
    tenantId: string,
    stripeEvent: StripeSubscriptionEvent
  ): Promise<Subscription> {
    console.info("[SubscriptionService.upsertFromStripeEvent] start", {
      tenantId,
    });
    try {
      const matchingPlans = await db
        .select()
        .from(plans)
        .where(
          or(
            eq(plans.stripePriceIdMonthly, stripeEvent.stripePriceId),
            eq(plans.stripePriceIdYearly, stripeEvent.stripePriceId)
          )
        )
        .limit(1);

      const plan = matchingPlans[0];
      if (!plan) {
        throw new SubscriptionNotFoundError(tenantId);
      }

      const now = new Date();
      const rows = await db
        .insert(subscriptions)
        .values({
          tenantId,
          planId: plan.id,
          stripeSubscriptionId: stripeEvent.stripeSubscriptionId,
          stripeCustomerId: stripeEvent.stripeCustomerId,
          status: stripeEvent.status,
          currentPeriodStart: stripeEvent.currentPeriodStart,
          currentPeriodEnd: stripeEvent.currentPeriodEnd,
          cancelAtPeriodEnd: stripeEvent.cancelAtPeriodEnd,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: {
            planId: plan.id,
            stripeCustomerId: stripeEvent.stripeCustomerId,
            status: stripeEvent.status,
            currentPeriodStart: stripeEvent.currentPeriodStart,
            currentPeriodEnd: stripeEvent.currentPeriodEnd,
            cancelAtPeriodEnd: stripeEvent.cancelAtPeriodEnd,
            updatedAt: now,
          },
        })
        .returning();

      const result = rows[0];
      if (!result) {
        throw new Error("Upsert returned no rows");
      }

      console.info("[SubscriptionService.upsertFromStripeEvent] done", {
        tenantId,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SubscriptionService.upsertFromStripeEvent] error", {
        tenantId,
        error: message,
      });
      throw err;
    }
  }

  async canUpgrade(tenantId: string): Promise<boolean> {
    console.info("[SubscriptionService.canUpgrade] start", { tenantId });
    try {
      const activePlan = await this.getActivePlan(tenantId);
      if (!activePlan) {
        console.info("[SubscriptionService.canUpgrade] done (no plan)", {
          tenantId,
        });
        return false;
      }
      const higherPlans = await db
        .select({ id: plans.id })
        .from(plans)
        .where(
          and(
            gt(plans.sortOrder, activePlan.sortOrder),
            eq(plans.isActive, true)
          )
        )
        .limit(1);
      const result = higherPlans.length > 0;
      console.info("[SubscriptionService.canUpgrade] done", { tenantId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SubscriptionService.canUpgrade] error", {
        tenantId,
        error: message,
      });
      throw err;
    }
  }

  async canDowngrade(tenantId: string): Promise<boolean> {
    console.info("[SubscriptionService.canDowngrade] start", { tenantId });
    try {
      const activePlan = await this.getActivePlan(tenantId);
      if (!activePlan) {
        console.info("[SubscriptionService.canDowngrade] done (no plan)", {
          tenantId,
        });
        return false;
      }
      const lowerPlans = await db
        .select({ id: plans.id })
        .from(plans)
        .where(
          and(
            lt(plans.sortOrder, activePlan.sortOrder),
            gt(plans.sortOrder, 0),
            eq(plans.isActive, true)
          )
        )
        .limit(1);
      const result = lowerPlans.length > 0;
      console.info("[SubscriptionService.canDowngrade] done", { tenantId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SubscriptionService.canDowngrade] error", {
        tenantId,
        error: message,
      });
      throw err;
    }
  }

  async isFeatureEnabled(
    tenantId: string,
    featureKey: keyof Plan["features"]
  ): Promise<boolean> {
    console.info("[SubscriptionService.isFeatureEnabled] start", { tenantId });
    try {
      const activePlan = await this.getActivePlan(tenantId);
      if (!activePlan) {
        console.info(
          "[SubscriptionService.isFeatureEnabled] done (no plan)",
          { tenantId }
        );
        return false;
      }
      const featureValue = activePlan.features[featureKey];
      const result =
        typeof featureValue === "boolean"
          ? featureValue
          : typeof featureValue === "number"
          ? featureValue > 0
          : false;
      console.info("[SubscriptionService.isFeatureEnabled] done", { tenantId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[SubscriptionService.isFeatureEnabled] error", {
        tenantId,
        error: message,
      });
      throw err;
    }
  }
}
