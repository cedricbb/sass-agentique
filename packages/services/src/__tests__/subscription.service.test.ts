import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@saas/db", () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };
  return {
    db: chainable,
    plans: {
      id: "plans.id",
      stripePriceIdMonthly: "plans.stripePriceIdMonthly",
      stripePriceIdYearly: "plans.stripePriceIdYearly",
      sortOrder: "plans.sortOrder",
      isActive: "plans.isActive",
      planId: "plans.planId",
    },
    subscriptions: {
      tenantId: "subscriptions.tenantId",
      stripeSubscriptionId: "subscriptions.stripeSubscriptionId",
      planId: "subscriptions.planId",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ["eq", ...args]),
  or: vi.fn((...args: unknown[]) => ["or", ...args]),
  gt: vi.fn((...args: unknown[]) => ["gt", ...args]),
  lt: vi.fn((...args: unknown[]) => ["lt", ...args]),
  and: vi.fn((...args: unknown[]) => ["and", ...args]),
}));

import {
  SubscriptionService,
  SubscriptionNotFoundError,
  type StripeSubscriptionEvent,
} from "../subscription.service";

// --- Fixtures ---

const defaultFeatures = {
  maxMembers: 1,
  maxContacts: 100,
  maxAgentTasksPerMonth: 0,
  maxEmailsPerMonth: 100,
  storageMb: 100,
  maxActiveWorkflows: 0,
  hasTwoFactor: false,
  hasAdminBackoffice: false,
  hasAiAgents: false,
  hasWorkflows: false,
  hasCustomDomain: false,
  hasWhiteLabel: false,
  hasAdvancedAnalytics: false,
  hasPrioritySupport: false,
  hasSla: false,
  hasDataExport: false,
};

const mockPlanFree = {
  id: "plan-free",
  slug: "free",
  name: "Free",
  stripeProductId: null,
  stripePriceIdMonthly: null,
  stripePriceIdYearly: null,
  priceMonthlyEurCents: 0,
  priceYearlyEurCents: 0,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  features: {
    ...defaultFeatures,
    hasCustomDomain: false,
    maxAgentTasksPerMonth: 0,
  },
};

const mockPlanPro = {
  id: "plan-pro",
  slug: "pro",
  name: "Pro",
  stripeProductId: "prod_pro",
  stripePriceIdMonthly: "price_pro_m",
  stripePriceIdYearly: "price_pro_y",
  priceMonthlyEurCents: 2900,
  priceYearlyEurCents: 29000,
  sortOrder: 1,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  features: {
    ...defaultFeatures,
    hasCustomDomain: false,
    maxAgentTasksPerMonth: 100,
  },
};

const mockPlanBusiness = {
  id: "plan-biz",
  slug: "business",
  name: "Business",
  stripeProductId: "prod_biz",
  stripePriceIdMonthly: "price_biz_m",
  stripePriceIdYearly: "price_biz_y",
  priceMonthlyEurCents: 7900,
  priceYearlyEurCents: 79000,
  sortOrder: 2,
  isActive: true,
  createdAt: new Date("2026-01-01"),
  features: {
    ...defaultFeatures,
    hasCustomDomain: true,
    maxAgentTasksPerMonth: 500,
  },
};

const mockSubscription = {
  id: "sub-1",
  tenantId: "t-1",
  planId: "plan-pro",
  stripeSubscriptionId: "stripe_sub_1",
  stripeCustomerId: "cus_1",
  status: "active" as const,
  currentPeriodStart: new Date("2026-05-01"),
  currentPeriodEnd: new Date("2026-06-01"),
  cancelAtPeriodEnd: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-05-01"),
};

const mockStripeEvent: StripeSubscriptionEvent = {
  stripeSubscriptionId: "stripe_sub_1",
  stripeCustomerId: "cus_1",
  stripePriceId: "price_pro_m",
  status: "active",
  currentPeriodStart: new Date("2026-05-01"),
  currentPeriodEnd: new Date("2026-06-01"),
  cancelAtPeriodEnd: false,
};

// --- Test Suite ---

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let mockDb: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    const { db } = await import("@saas/db");
    mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
    service = new SubscriptionService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── getByTenantId ──────────────────────────────────────────

  describe("getByTenantId", () => {
    it("returns the subscription when found", async () => {
      mockDb.limit.mockResolvedValueOnce([mockSubscription]);

      const result = await service.getByTenantId("t-1");

      expect(result).toEqual(mockSubscription);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it("returns null when no subscription found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.getByTenantId("t-unknown");

      expect(result).toBeNull();
    });

    it("logs start and done via console.info", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mockDb.limit.mockResolvedValueOnce([mockSubscription]);

      await service.getByTenantId("t-1");

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("getByTenantId] start"),
        expect.objectContaining({ tenantId: "t-1" })
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("getByTenantId] done"),
        expect.objectContaining({ tenantId: "t-1" })
      );
      spy.mockRestore();
    });
  });

  // ── getActivePlan ──────────────────────────────────────────

  describe("getActivePlan", () => {
    it("returns the plan when subscription exists", async () => {
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanPro }]);

      const result = await service.getActivePlan("t-1");

      expect(result).toEqual(mockPlanPro);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.innerJoin).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it("returns null when no subscription exists", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.getActivePlan("t-unknown");

      expect(result).toBeNull();
    });

    it("logs start and done via console.info", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanPro }]);

      await service.getActivePlan("t-1");

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("getActivePlan] start"),
        expect.objectContaining({ tenantId: "t-1" })
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("getActivePlan] done"),
        expect.objectContaining({ tenantId: "t-1" })
      );
      spy.mockRestore();
    });
  });

  // ── upsertFromStripeEvent ──────────────────────────────────

  describe("upsertFromStripeEvent", () => {
    it("upserts subscription on happy path", async () => {
      // First limit call: plan lookup
      mockDb.limit.mockResolvedValueOnce([mockPlanPro]);
      // returning: upsert result
      mockDb.returning.mockResolvedValueOnce([mockSubscription]);

      const result = await service.upsertFromStripeEvent("t-1", mockStripeEvent);

      expect(result).toEqual(mockSubscription);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("calls onConflictDoUpdate with target stripeSubscriptionId for idempotence", async () => {
      mockDb.limit.mockResolvedValueOnce([mockPlanPro]);
      mockDb.returning.mockResolvedValueOnce([mockSubscription]);

      await service.upsertFromStripeEvent("t-1", mockStripeEvent);

      expect(mockDb.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "subscriptions.stripeSubscriptionId",
        })
      );
    });

    it("throws SubscriptionNotFoundError when plan not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.upsertFromStripeEvent("t-1", mockStripeEvent)
      ).rejects.toThrow(SubscriptionNotFoundError);

      // Verify error carries tenantId
      mockDb.limit.mockResolvedValueOnce([]);
      await service.upsertFromStripeEvent("t-1", mockStripeEvent).catch((e) => {
        expect(e).toBeInstanceOf(SubscriptionNotFoundError);
        expect((e as SubscriptionNotFoundError).tenantId).toBe("t-1");
      });
    });

    it("logs start and done via console.info", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mockDb.limit.mockResolvedValueOnce([mockPlanPro]);
      mockDb.returning.mockResolvedValueOnce([mockSubscription]);

      await service.upsertFromStripeEvent("t-1", mockStripeEvent);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("upsertFromStripeEvent] start"),
        expect.objectContaining({ tenantId: "t-1" })
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("upsertFromStripeEvent] done"),
        expect.objectContaining({ tenantId: "t-1" })
      );
      spy.mockRestore();
    });
  });

  // ── canUpgrade ─────────────────────────────────────────────

  describe("canUpgrade", () => {
    it("returns true when higher plans exist (Free → can upgrade)", async () => {
      // First limit: getActivePlan returns Free
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanFree }]);
      // Second limit: higher plans query returns a result
      mockDb.limit.mockResolvedValueOnce([{ id: "plan-pro" }]);

      const result = await service.canUpgrade("t-1");

      expect(result).toBe(true);
    });

    it("returns false when no higher plans exist (Business = top)", async () => {
      // First limit: getActivePlan returns Business
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanBusiness }]);
      // Second limit: no higher plans
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.canUpgrade("t-1");

      expect(result).toBe(false);
    });

    it("returns false when no active plan exists", async () => {
      // First limit: getActivePlan returns empty
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.canUpgrade("t-no-plan");

      expect(result).toBe(false);
    });
  });

  // ── canDowngrade ───────────────────────────────────────────

  describe("canDowngrade", () => {
    it("returns true when lower plans exist (Business → can downgrade to Pro)", async () => {
      // First limit: getActivePlan returns Business
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanBusiness }]);
      // Second limit: lower plans with sortOrder > 0 returns Pro
      mockDb.limit.mockResolvedValueOnce([{ id: "plan-pro" }]);

      const result = await service.canDowngrade("t-1");

      expect(result).toBe(true);
    });

    it("returns false when on Free plan (sortOrder=0, no plan with sortOrder < 0 and > 0)", async () => {
      // First limit: getActivePlan returns Free
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanFree }]);
      // Second limit: no lower plans (gt(sortOrder, 0) excludes everything below sortOrder=0)
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.canDowngrade("t-1");

      expect(result).toBe(false);
    });

    it("returns false when no active plan exists", async () => {
      // First limit: getActivePlan returns empty
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.canDowngrade("t-no-plan");

      expect(result).toBe(false);
    });
  });

  // ── isFeatureEnabled ───────────────────────────────────────

  describe("isFeatureEnabled", () => {
    it("returns true for boolean feature that is true (hasCustomDomain on Business)", async () => {
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanBusiness }]);

      const result = await service.isFeatureEnabled("t-1", "hasCustomDomain");

      expect(result).toBe(true);
    });

    it("returns false for boolean feature that is false (hasCustomDomain on Free)", async () => {
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanFree }]);

      const result = await service.isFeatureEnabled("t-1", "hasCustomDomain");

      expect(result).toBe(false);
    });

    it("returns true for numeric feature > 0 (maxAgentTasksPerMonth on Pro = 100)", async () => {
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanPro }]);

      const result = await service.isFeatureEnabled("t-1", "maxAgentTasksPerMonth");

      expect(result).toBe(true);
    });

    it("returns false for numeric feature === 0 (maxAgentTasksPerMonth on Free = 0)", async () => {
      mockDb.limit.mockResolvedValueOnce([{ plan: mockPlanFree }]);

      const result = await service.isFeatureEnabled("t-1", "maxAgentTasksPerMonth");

      expect(result).toBe(false);
    });

    it("returns false when no active plan exists", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.isFeatureEnabled("t-no-plan", "hasCustomDomain");

      expect(result).toBe(false);
    });
  });
});
