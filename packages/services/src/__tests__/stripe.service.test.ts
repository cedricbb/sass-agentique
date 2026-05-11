import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockCustomersCreate,
  mockCustomersRetrieve,
  mockCheckoutSessionsCreate,
  mockPortalSessionsCreate,
  mockSubscriptionsUpdate,
  StripeError,
} = vi.hoisted(() => {
  class StripeError extends Error {
    type: string;
    statusCode: number;
    constructor(message: string, type: string, statusCode = 400) {
      super(message);
      this.type = type;
      this.statusCode = statusCode;
    }
  }
  return {
    mockCustomersCreate: vi.fn(),
    mockCustomersRetrieve: vi.fn(),
    mockCheckoutSessionsCreate: vi.fn(),
    mockPortalSessionsCreate: vi.fn(),
    mockSubscriptionsUpdate: vi.fn(),
    StripeError,
  };
});

vi.mock("stripe", () => {
  const StripeMock = vi.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate, retrieve: mockCustomersRetrieve },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
    subscriptions: { update: mockSubscriptionsUpdate },
  }));
  (StripeMock as any).errors = { StripeError };
  return { default: StripeMock };
});

import { StripeService, StripeServiceError } from "../stripe.service";

const tid = "tenant_1";

describe("StripeService", () => {
  let service: StripeService;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    service = new StripeService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe("constructor", () => {
    it("throws StripeServiceError when STRIPE_SECRET_KEY is missing", () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(() => new StripeService()).toThrow(StripeServiceError);
      try {
        new StripeService();
      } catch (e: any) {
        expect(e.code).toBe("stripe/config_error");
      }
    });
  });

  describe("createCustomer", () => {
    it("returns StripeCustomer on happy path", async () => {
      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_1", email: "a@b.c", name: "Alice" });
      const result = await service.createCustomer(tid, "a@b.c", "Alice");
      expect(result).toEqual({ stripeCustomerId: "cus_1", tenantId: tid, email: "a@b.c", name: "Alice" });
      expect(mockCustomersCreate).toHaveBeenCalledWith({ email: "a@b.c", name: "Alice", metadata: { tenantId: tid } });
    });

    it("wraps StripeError into StripeServiceError", async () => {
      mockCustomersCreate.mockRejectedValueOnce(new StripeError("card declined", "card_error"));
      await expect(service.createCustomer(tid, "a@b.c", "Alice")).rejects.toThrow(StripeServiceError);
      mockCustomersCreate.mockRejectedValueOnce(new StripeError("card declined", "card_error"));
      await service.createCustomer(tid, "a@b.c", "Alice").catch((e: any) => {
        expect(e.code).toBe("stripe/card_error");
      });
    });

    it("wraps unknown error with code stripe/unknown_error", async () => {
      mockCustomersCreate.mockRejectedValueOnce(new Error("boom"));
      await expect(service.createCustomer(tid, "a@b.c", "Alice")).rejects.toThrow(StripeServiceError);
      mockCustomersCreate.mockRejectedValueOnce(new Error("boom"));
      await service.createCustomer(tid, "a@b.c", "Alice").catch((e: any) => {
        expect(e.code).toBe("stripe/unknown_error");
      });
    });

    it("logs start and done via console.info", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_1", email: "a@b.c", name: "Alice" });
      await service.createCustomer(tid, "a@b.c", "Alice");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("start"), expect.objectContaining({ tenantId: tid }));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("done"), expect.objectContaining({ tenantId: tid }));
      spy.mockRestore();
    });
  });

  describe("getCustomer", () => {
    it("returns StripeCustomer on happy path", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({ id: "cus_1", email: "a@b.c", name: "Alice", deleted: false });
      const result = await service.getCustomer(tid, "cus_1");
      expect(result).toEqual({ stripeCustomerId: "cus_1", tenantId: tid, email: "a@b.c", name: "Alice" });
    });

    it("returns null on 404 StripeError", async () => {
      mockCustomersRetrieve.mockRejectedValueOnce(new StripeError("not found", "invalid_request_error", 404));
      const result = await service.getCustomer(tid, "cus_missing");
      expect(result).toBeNull();
    });

    it("returns null when customer.deleted is true", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({ id: "cus_1", deleted: true });
      const result = await service.getCustomer(tid, "cus_1");
      expect(result).toBeNull();
    });

    it("wraps non-404 StripeError", async () => {
      mockCustomersRetrieve.mockRejectedValueOnce(new StripeError("server", "api_error", 500));
      await expect(service.getCustomer(tid, "cus_1")).rejects.toThrow(StripeServiceError);
      mockCustomersRetrieve.mockRejectedValueOnce(new StripeError("server", "api_error", 500));
      await service.getCustomer(tid, "cus_1").catch((e: any) => {
        expect(e.code).toBe("stripe/api_error");
      });
    });
  });

  describe("createCheckoutSession", () => {
    const baseParams = {
      successUrl: "https://ok",
      cancelUrl: "https://cancel",
      stripeCustomerId: "cus_1",
      clientReferenceId: "ref_1",
    };

    it("handles mode subscription with priceId", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_1", url: "https://x" });
      const result = await service.createCheckoutSession(tid, { ...baseParams, mode: "subscription" as const, priceId: "price_1" });
      expect(result).toEqual({ sessionId: "cs_1", url: "https://x" });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }] })
      );
    });

    it("handles mode payment with price_data", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_2", url: "https://y" });
      const result = await service.createCheckoutSession(tid, { ...baseParams, mode: "payment" as const, productId: "prod_1", unitAmountCents: 999 });
      expect(result).toEqual({ sessionId: "cs_2", url: "https://y" });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          line_items: [{ quantity: 1, price_data: { currency: "eur", product: "prod_1", unit_amount: 999 } }],
        })
      );
    });

    it("throws StripeServiceError when session.url is null", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_3", url: null });
      await expect(
        service.createCheckoutSession(tid, { ...baseParams, mode: "subscription" as const, priceId: "price_1" })
      ).rejects.toThrow(StripeServiceError);
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_3", url: null });
      await service
        .createCheckoutSession(tid, { ...baseParams, mode: "subscription" as const, priceId: "price_1" })
        .catch((e: any) => {
          expect(e.code).toBe("stripe/missing_url");
        });
    });

    it("wraps StripeError", async () => {
      mockCheckoutSessionsCreate.mockRejectedValueOnce(new StripeError("fail", "api_error"));
      await expect(
        service.createCheckoutSession(tid, { ...baseParams, mode: "subscription" as const, priceId: "price_1" })
      ).rejects.toThrow(StripeServiceError);
    });
  });

  describe("createPortalSession", () => {
    it("returns portal URL on happy path", async () => {
      mockPortalSessionsCreate.mockResolvedValueOnce({ url: "https://portal" });
      const result = await service.createPortalSession(tid, "cus_1", "https://return");
      expect(result).toEqual({ url: "https://portal" });
    });

    it("wraps StripeError", async () => {
      mockPortalSessionsCreate.mockRejectedValueOnce(new StripeError("fail", "api_error"));
      await expect(service.createPortalSession(tid, "cus_1", "https://return")).rejects.toThrow(StripeServiceError);
    });
  });

  describe("cancelSubscription", () => {
    it("returns CancelledSubscription on happy path", async () => {
      mockSubscriptionsUpdate.mockResolvedValueOnce({ id: "sub_1", cancel_at_period_end: true, current_period_end: 1700000000 });
      const result = await service.cancelSubscription(tid, "sub_1");
      expect(result).toEqual({
        stripeSubscriptionId: "sub_1",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(1700000000 * 1000),
      });
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    });

    it("wraps StripeError", async () => {
      mockSubscriptionsUpdate.mockRejectedValueOnce(new StripeError("fail", "api_error"));
      await expect(service.cancelSubscription(tid, "sub_1")).rejects.toThrow(StripeServiceError);
    });
  });
});
