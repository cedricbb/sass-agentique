import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockConstructEvent, stripeEventsStore, mockEnv } = vi.hoisted(() => {
  return {
    mockConstructEvent: vi.fn(),
    stripeEventsStore: new Map<string, unknown>(),
    mockEnv: { STRIPE_WEBHOOKS_ENABLED: true as boolean },
  };
});

vi.mock("@saas/config", () => ({
  env: mockEnv,
}));

vi.mock("@saas/services/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("stripe", () => {
  const StripeConstructor = vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  }));
  (StripeConstructor as unknown as { errors: Record<string, unknown> }).errors = {};
  return { default: StripeConstructor };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args[0]),
  isNull: vi.fn((col: unknown) => col),
  isNotNull: vi.fn((col: unknown) => col),
  sql: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  ilike: vi.fn(),
  getTableColumns: vi.fn(() => ({})),
}));

vi.mock("@saas/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((vals: { eventId: string; type: string; payloadJson: unknown }) => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (stripeEventsStore.has(vals.eventId)) {
              return [];
            }
            const record = {
              id: `uuid-${vals.eventId}`,
              eventId: vals.eventId,
              type: vals.type,
              payloadJson: vals.payloadJson,
              receivedAt: new Date(),
              processedAt: null,
              createdAt: new Date(),
            };
            stripeEventsStore.set(vals.eventId, record);
            return [record];
          }),
        })),
      })),
    })),
    select: vi.fn(() => {
      let capturedId: unknown;
      return {
        from: vi.fn(() => ({
          where: vi.fn((id: unknown) => {
            capturedId = id;
            return {
              limit: vi.fn(async () => {
                const record = stripeEventsStore.get(capturedId as string);
                return record ? [record] : [];
              }),
            };
          }),
        })),
      };
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => []),
        })),
      })),
    })),
  },
  stripeEvents: { eventId: "event_id" },
}));

vi.mock("@saas/workflows", () => ({
  inngest: { send: vi.fn() },
}));

import { __resetStripeClientForTests } from "@saas/services";
import { inngest } from "@saas/workflows";
import { handleStripeWebhook } from "../webhook-handler";

const mockSend = vi.mocked(inngest.send);

function makeRequest(body: string, signature = "t=12345,v1=test"): NextRequest {
  return new NextRequest("https://example.com/api/stripe/webhooks", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
  });
}

function makeStripeEvent(id: string, type: string): object {
  return {
    id,
    type,
    object: "event",
    data: { object: { id: "pi_test", amount: 2000 } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  stripeEventsStore.clear();
  mockEnv.STRIPE_WEBHOOKS_ENABLED = true;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_integ");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_integ");
  __resetStripeClientForTests();
});

describe("stripe webhook integration chain", () => {
  it("integration_happy_path_pi_succeeded_dispatches_to_inngest", async () => {
    const event = makeStripeEvent("evt_success_001", "payment_intent.succeeded");
    mockConstructEvent.mockReturnValue(event);
    mockSend.mockResolvedValue(undefined as never);

    const res = await handleStripeWebhook(makeRequest(JSON.stringify(event)));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("dispatched");
    expect(body.eventId).toBe("evt_success_001");
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({
      name: "stripe/payment-intent.succeeded",
      data: { event },
    });
    expect(stripeEventsStore.has("evt_success_001")).toBe(true);
  });

  it("integration_happy_path_pi_failed_dispatches_to_inngest", async () => {
    const event = makeStripeEvent("evt_failed_001", "payment_intent.payment_failed");
    mockConstructEvent.mockReturnValue(event);
    mockSend.mockResolvedValue(undefined as never);

    const res = await handleStripeWebhook(makeRequest(JSON.stringify(event)));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("dispatched");
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({
      name: "stripe/payment-intent.failed",
      data: { event },
    });
  });

  it("integration_idempotence_replay_dispatches_once", async () => {
    const event = makeStripeEvent("evt_replay_001", "payment_intent.succeeded");
    mockConstructEvent.mockReturnValue(event);
    mockSend.mockResolvedValue(undefined as never);

    const rawBody = JSON.stringify(event);

    const res1 = await handleStripeWebhook(makeRequest(rawBody));
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.status).toBe("dispatched");

    const res2 = await handleStripeWebhook(makeRequest(rawBody));
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.status).toBe("already_processed");
    expect(body2.eventId).toBe("evt_replay_001");

    expect(mockSend).toHaveBeenCalledOnce();
    expect(stripeEventsStore.size).toBe(1);
  });

  it("integration_invalid_signature_returns_400_no_dispatch", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Webhook signature verification failed.");
    });

    const res = await handleStripeWebhook(
      makeRequest('{"id":"evt_bad","type":"payment_intent.succeeded"}'),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid request");
    expect(mockSend).not.toHaveBeenCalled();
    expect(stripeEventsStore.size).toBe(0);
  });

  it("integration_unknown_event_type_recorded_not_dispatched", async () => {
    const event = makeStripeEvent("evt_unknown_001", "customer.created");
    mockConstructEvent.mockReturnValue(event);

    const res = await handleStripeWebhook(makeRequest(JSON.stringify(event)));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ignored");
    expect(body.eventId).toBe("evt_unknown_001");
    expect(mockSend).not.toHaveBeenCalled();
    expect(stripeEventsStore.has("evt_unknown_001")).toBe(true);
  });
});
