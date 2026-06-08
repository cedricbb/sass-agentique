import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockCustomersCreate,
  mockCustomersRetrieve,
  mockCheckoutSessionsCreate,
  mockPortalSessionsCreate,
  mockSubscriptionsUpdate,
  mockWebhooksConstructEvent,
  StripeError,
} = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_mock";
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
    mockWebhooksConstructEvent: vi.fn(),
    StripeError,
  };
});

vi.mock("stripe", () => {
  const StripeMock = vi.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate, retrieve: mockCustomersRetrieve },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
    subscriptions: { update: mockSubscriptionsUpdate },
    webhooks: { constructEvent: mockWebhooksConstructEvent },
  }));
  (StripeMock as any).errors = { StripeError };
  return { default: StripeMock };
});

import {
  StripeService,
  StripeServiceError,
  getStripeService,
  __resetStripeServiceForTests,
  getStripeClient,
  __resetStripeClientForTests,
  __getStripeClientKeyHashForTests,
  hashSecretKey,
  verifyWebhookSignature,
} from "../stripe.service";
import type { CreateCheckoutSessionParams } from "../stripe.service";

describe("StripeService", () => {
  let service: StripeService;

  beforeEach(() => {
    __resetStripeServiceForTests();
    __resetStripeClientForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";
    service = new StripeService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  describe("constructor", () => {
    it("does not throw when STRIPE_SECRET_KEY is missing (lazy init)", () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(() => new StripeService()).not.toThrow();
    });
  });

  describe("lazy singleton (getStripeService)", () => {
    it("getStripeService() returns a StripeService instance", () => {
      expect(getStripeService()).toBeInstanceOf(StripeService);
    });

    it("getStripeService() returns the same instance on subsequent calls", () => {
      const a = getStripeService();
      const b = getStripeService();
      expect(a).toBe(b);
    });

    it("__resetStripeServiceForTests() clears the cached instance", () => {
      const a = getStripeService();
      __resetStripeServiceForTests();
      const b = getStripeService();
      expect(a).not.toBe(b);
    });

    it("getStripeService() does not throw when STRIPE_SECRET_KEY is missing (lazy — throws on method call)", () => {
      delete process.env.STRIPE_SECRET_KEY;
      __resetStripeServiceForTests();
      expect(() => getStripeService()).not.toThrow();
    });
  });

  describe("getStripeClient", () => {
    beforeEach(() => {
      __resetStripeClientForTests();
    });

    it("get_stripe_client_returns_stripe_instance", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_x";
      const client = getStripeClient();
      expect(client).toBeDefined();
    });

    it("get_stripe_client_throws_config_error_when_key_missing", () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(() => getStripeClient()).toThrow(StripeServiceError);
      try {
        getStripeClient();
      } catch (e: any) {
        expect(e.code).toBe("stripe/config_error");
      }
    });

    it("get_stripe_client_reinstantiates_on_key_change", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_a";
      const a = getStripeClient();
      process.env.STRIPE_SECRET_KEY = "sk_test_b";
      const b = getStripeClient();
      expect(a).not.toBe(b);
    });

    it("reset_stripe_client_for_tests_clears_singleton", () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_x";
      const a = getStripeClient();
      __resetStripeClientForTests();
      const b = getStripeClient();
      expect(a).not.toBe(b);
    });

    it("get_stripe_client_stores_hash_not_raw_key", () => {
      const rawKey = "sk_test_hash_check";
      process.env.STRIPE_SECRET_KEY = rawKey;
      getStripeClient();
      const stored = __getStripeClientKeyHashForTests();
      expect(stored).not.toBeNull();
      expect(stored).not.toBe(rawKey);
      expect(stored).toHaveLength(64);
      expect(stored).toMatch(/^[0-9a-f]{64}$/);
      expect(stored).toBe(hashSecretKey(rawKey));
    });
  });

  describe("verifyWebhookSignature", () => {
    it("verify_webhook_signature_returns_event_on_valid_sig", () => {
      const mockEvent = { id: "evt_1", type: "customer.created", object: "event" };
      mockWebhooksConstructEvent.mockReturnValueOnce(mockEvent);
      const result = verifyWebhookSignature("body", "t=1,v1=abc");
      expect(result).toEqual(mockEvent);
    });

    it("verify_webhook_signature_throws_invalid_signature", () => {
      mockWebhooksConstructEvent.mockImplementationOnce(() => {
        throw new Error("No signatures found matching the expected signature");
      });
      expect(() => verifyWebhookSignature("body", "bad_sig")).toThrow(StripeServiceError);
      mockWebhooksConstructEvent.mockImplementationOnce(() => {
        throw new Error("No signatures found matching the expected signature");
      });
      try {
        verifyWebhookSignature("body", "bad_sig");
      } catch (e: any) {
        expect(e.code).toBe("stripe/invalid_signature");
      }
    });

    it("verify_webhook_signature_throws_generic_message_not_sdk_verbatim", () => {
      const sdkError = new Error("No signatures found matching the expected signature for payload. Are you passing the raw request body...");
      mockWebhooksConstructEvent.mockImplementationOnce(() => {
        throw sdkError;
      });
      try {
        verifyWebhookSignature("body", "bad_sig");
        expect.fail("should have thrown");
      } catch (e: any) {
        expect(e).toBeInstanceOf(StripeServiceError);
        expect(e.message).toBe("Webhook signature verification failed");
        expect(e.cause).toBe(sdkError);
      }
    });

    it("verify_webhook_signature_throws_config_error_when_secret_missing", () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(() => verifyWebhookSignature("body", "sig")).toThrow(StripeServiceError);
      try {
        verifyWebhookSignature("body", "sig");
      } catch (e: any) {
        expect(e.code).toBe("stripe/config_error");
      }
    });
  });

  describe("createCustomer", () => {
    it("returns Stripe.Customer on happy path", async () => {
      const customer = { id: "cus_1", object: "customer", email: "a@b.c", name: "Alice" };
      mockCustomersCreate.mockResolvedValueOnce(customer);
      const result = await service.createCustomer({ email: "a@b.c", name: "Alice" });
      expect(result).toEqual(customer);
      expect(mockCustomersCreate).toHaveBeenCalledWith({ email: "a@b.c", name: "Alice" });
    });

    it("passes clientId to metadata when provided", async () => {
      const customer = { id: "cus_1", object: "customer", email: "a@b.c", name: "Alice" };
      mockCustomersCreate.mockResolvedValueOnce(customer);
      await service.createCustomer({ email: "a@b.c", name: "Alice", clientId: "client_42" });
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: "a@b.c",
        name: "Alice",
        metadata: { clientId: "client_42" },
      });
    });

    it("wraps StripeError into StripeServiceError", async () => {
      mockCustomersCreate.mockRejectedValueOnce(new StripeError("card declined", "card_error"));
      await expect(service.createCustomer({ email: "a@b.c" })).rejects.toThrow(StripeServiceError);
      mockCustomersCreate.mockRejectedValueOnce(new StripeError("card declined", "card_error"));
      await service.createCustomer({ email: "a@b.c" }).catch((e: any) => {
        expect(e.code).toBe("stripe/card_error");
      });
    });

    it("wraps unknown error with code stripe/unknown_error", async () => {
      mockCustomersCreate.mockRejectedValueOnce(new Error("boom"));
      await expect(service.createCustomer({ email: "a@b.c" })).rejects.toThrow(StripeServiceError);
      mockCustomersCreate.mockRejectedValueOnce(new Error("boom"));
      await service.createCustomer({ email: "a@b.c" }).catch((e: any) => {
        expect(e.code).toBe("stripe/unknown_error");
      });
    });

    it("logs clientId but never raw email", async () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});
      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_1", email: "a@b.c", name: "Alice" });
      await service.createCustomer({ email: "a@b.c", clientId: "client_42" });
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("a@b.c");
      }
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("start"),
        expect.objectContaining({ clientId: "client_42" })
      );
      spy.mockRestore();
    });
  });

  describe("getCustomer", () => {
    it("returns Stripe.Customer on happy path", async () => {
      const customer = { id: "cus_1", object: "customer", email: "a@b.c", name: "Alice" };
      mockCustomersRetrieve.mockResolvedValueOnce(customer);
      const result = await service.getCustomer("cus_1");
      expect(result).toEqual(customer);
    });

    it("returns null on 404 StripeError", async () => {
      mockCustomersRetrieve.mockRejectedValueOnce(new StripeError("not found", "invalid_request_error", 404));
      const result = await service.getCustomer("cus_missing");
      expect(result).toBeNull();
    });

    it("returns null when customer.deleted is true", async () => {
      mockCustomersRetrieve.mockResolvedValueOnce({ id: "cus_1", deleted: true });
      const result = await service.getCustomer("cus_1");
      expect(result).toBeNull();
    });

    it("wraps non-404 StripeError", async () => {
      mockCustomersRetrieve.mockRejectedValueOnce(new StripeError("server", "api_error", 500));
      await expect(service.getCustomer("cus_1")).rejects.toThrow(StripeServiceError);
      mockCustomersRetrieve.mockRejectedValueOnce(new StripeError("server", "api_error", 500));
      await service.getCustomer("cus_1").catch((e: any) => {
        expect(e.code).toBe("stripe/api_error");
      });
    });
  });

  describe("createCheckoutSession", () => {
    it("handles subscription mode with correct metadata", async () => {
      const session = { id: "cs_1", url: "https://x", object: "checkout.session" };
      mockCheckoutSessionsCreate.mockResolvedValueOnce(session);
      const params: CreateCheckoutSessionParams = {
        mode: "subscription",
        maintenanceContractId: "mc_1",
        customerId: "cus_1",
        priceId: "price_1",
        successUrl: "https://ok",
        cancelUrl: "https://cancel",
      };
      const result = await service.createCheckoutSession(params);
      expect(result).toEqual(session);
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer: "cus_1",
          line_items: [{ price: "price_1", quantity: 1 }],
          metadata: { maintenanceContractId: "mc_1", source: "maintenance" },
        })
      );
    });

    it("handles payment mode with correct metadata", async () => {
      const session = { id: "cs_2", url: "https://y", object: "checkout.session" };
      mockCheckoutSessionsCreate.mockResolvedValueOnce(session);
      const params: CreateCheckoutSessionParams = {
        mode: "payment",
        invoiceId: "inv_1",
        customerId: "cus_1",
        amountEurCents: 999,
        successUrl: "https://ok",
        cancelUrl: "https://cancel",
        description: "Invoice #42",
      };
      const result = await service.createCheckoutSession(params);
      expect(result).toEqual(session);
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          customer: "cus_1",
          payment_method_types: ["card"],
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: 999,
                product_data: { name: "Invoice #42" },
              },
            },
          ],
          metadata: { invoiceId: "inv_1", source: "invoice" },
        })
      );
    });

    it("uses default description for payment when not provided", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_3", url: "https://z" });
      await service.createCheckoutSession({
        mode: "payment",
        invoiceId: "inv_2",
        customerId: "cus_1",
        amountEurCents: 500,
        successUrl: "https://ok",
        cancelUrl: "https://cancel",
      });
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: { name: "Payment" },
              }),
            }),
          ],
        })
      );
    });

    it("throws StripeServiceError when session.url is null", async () => {
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_4", url: null });
      await expect(
        service.createCheckoutSession({
          mode: "subscription",
          maintenanceContractId: "mc_1",
          customerId: "cus_1",
          priceId: "price_1",
          successUrl: "https://ok",
          cancelUrl: "https://cancel",
        })
      ).rejects.toThrow(StripeServiceError);
      mockCheckoutSessionsCreate.mockResolvedValueOnce({ id: "cs_4", url: null });
      await service
        .createCheckoutSession({
          mode: "subscription",
          maintenanceContractId: "mc_1",
          customerId: "cus_1",
          priceId: "price_1",
          successUrl: "https://ok",
          cancelUrl: "https://cancel",
        })
        .catch((e: any) => {
          expect(e.code).toBe("stripe/missing_url");
        });
    });

    it("wraps StripeError", async () => {
      mockCheckoutSessionsCreate.mockRejectedValueOnce(new StripeError("fail", "api_error"));
      await expect(
        service.createCheckoutSession({
          mode: "subscription",
          maintenanceContractId: "mc_1",
          customerId: "cus_1",
          priceId: "price_1",
          successUrl: "https://ok",
          cancelUrl: "https://cancel",
        })
      ).rejects.toThrow(StripeServiceError);
    });
  });

  describe("createPortalSession", () => {
    it("returns BillingPortal.Session on happy path", async () => {
      const session = { url: "https://portal", object: "billing_portal.session" };
      mockPortalSessionsCreate.mockResolvedValueOnce(session);
      const result = await service.createPortalSession("cus_1", "https://return");
      expect(result).toEqual(session);
      expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
        customer: "cus_1",
        return_url: "https://return",
      });
    });

    it("wraps StripeError", async () => {
      mockPortalSessionsCreate.mockRejectedValueOnce(new StripeError("fail", "api_error"));
      await expect(service.createPortalSession("cus_1", "https://return")).rejects.toThrow(StripeServiceError);
    });
  });

  describe("cancelSubscription", () => {
    it("returns Stripe.Subscription on happy path", async () => {
      const sub = { id: "sub_1", cancel_at_period_end: true, current_period_end: 1700000000, object: "subscription" };
      mockSubscriptionsUpdate.mockResolvedValueOnce(sub);
      const result = await service.cancelSubscription("sub_1");
      expect(result).toEqual(sub);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    });

    it("wraps StripeError", async () => {
      mockSubscriptionsUpdate.mockRejectedValueOnce(new StripeError("fail", "api_error"));
      await expect(service.cancelSubscription("sub_1")).rejects.toThrow(StripeServiceError);
    });
  });
});
