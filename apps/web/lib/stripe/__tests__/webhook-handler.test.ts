import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@saas/services", () => ({
  verifyWebhookSignature: vi.fn(),
  recordStripeEvent: vi.fn(),
  StripeServiceError: class StripeServiceError extends Error {
    code: string;
    constructor(message: string, code: string, cause?: unknown) {
      super(message);
      this.name = "StripeServiceError";
      this.code = code;
      if (cause) this.cause = cause;
    }
  },
}));

vi.mock("@saas/workflows", () => ({
  inngest: { send: vi.fn() },
}));

import {
  verifyWebhookSignature,
  recordStripeEvent,
  StripeServiceError,
} from "@saas/services";
import { inngest } from "@saas/workflows";
import { handleStripeWebhook } from "../webhook-handler";

const mockVerify = vi.mocked(verifyWebhookSignature);
const mockRecord = vi.mocked(recordStripeEvent);
const mockSend = vi.mocked(inngest.send);

function makeRequest(options: {
  body?: string;
  signature?: string | null;
  enabled?: string;
  contentLength?: string | null;
}): NextRequest {
  const {
    body = '{"id":"evt_1","type":"payment_intent.succeeded","object":"event"}',
    signature = "t=12345,v1=abc",
    enabled = "true",
    contentLength = undefined,
  } = options;

  vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", enabled);

  const url = "https://example.com/api/stripe/webhooks";
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (signature !== null) {
    headers["stripe-signature"] = signature;
  }
  if (contentLength !== undefined && contentLength !== null) {
    headers["content-length"] = contentLength;
  }

  return new NextRequest(url, {
    method: "POST",
    body,
    headers,
  });
}

const SAMPLE_EVENT = {
  id: "evt_test_001",
  type: "payment_intent.succeeded",
  object: "event",
  data: { object: { id: "pi_001", amount: 1000 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("handleStripeWebhook", () => {
  it("webhook_returns_503_when_toggle_disabled", async () => {
    const req = makeRequest({ enabled: "false" });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("service unavailable");
  });

  it("webhook_returns_400_when_signature_header_missing", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const req = makeRequest({ signature: null });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing signature");
  });

  it("webhook_returns_400_when_body_empty", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const req = makeRequest({ body: "" });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("empty body");
  });

  it("webhook_returns_413_when_payload_too_large", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const oversizedBody = "x".repeat(512 * 1024 + 1);
    const req = makeRequest({ body: oversizedBody });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("payload too large");
  });

  it("webhook_returns_400_on_invalid_signature_without_leaking_error", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const sdkMessage = "Webhook signature verification failed. SECRET_DETAIL";
    mockVerify.mockImplementation(() => {
      throw new StripeServiceError(sdkMessage, "stripe/invalid_signature");
    });
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid request");
    const responseText = JSON.stringify(body);
    expect(responseText).not.toContain(sdkMessage);
    expect(responseText).not.toContain("SECRET_DETAIL");
  });

  it("webhook_returns_503_on_config_error", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    mockVerify.mockImplementation(() => {
      throw new StripeServiceError(
        "STRIPE_WEBHOOK_SECRET is not defined",
        "stripe/config_error",
      );
    });
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("service unavailable");
  });

  it("webhook_returns_already_processed_on_duplicate_event", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    mockVerify.mockReturnValue(SAMPLE_EVENT as never);
    mockRecord.mockResolvedValue({
      inserted: false,
      record: { eventId: SAMPLE_EVENT.id } as never,
    });
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("already_processed");
    expect(body.eventId).toBe(SAMPLE_EVENT.id);
    expect(body.received).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("webhook_dispatches_payment_intent_succeeded_to_inngest", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const event = { ...SAMPLE_EVENT, type: "payment_intent.succeeded" };
    mockVerify.mockReturnValue(event as never);
    mockRecord.mockResolvedValue({
      inserted: true,
      record: { eventId: event.id } as never,
    });
    mockSend.mockResolvedValue(undefined as never);
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("dispatched");
    expect(body.received).toBe(true);
    expect(body.eventId).toBe(event.id);
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith({
      name: "stripe/payment-intent.succeeded",
      data: { event },
    });
  });

  it("webhook_dispatches_payment_intent_failed_to_inngest", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const event = { ...SAMPLE_EVENT, type: "payment_intent.payment_failed" };
    mockVerify.mockReturnValue(event as never);
    mockRecord.mockResolvedValue({
      inserted: true,
      record: { eventId: event.id } as never,
    });
    mockSend.mockResolvedValue(undefined as never);
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("dispatched");
    expect(mockSend).toHaveBeenCalledWith({
      name: "stripe/payment-intent.failed",
      data: { event },
    });
  });

  it("webhook_returns_ignored_for_unknown_event_type", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const event = { ...SAMPLE_EVENT, type: "customer.created" };
    mockVerify.mockReturnValue(event as never);
    mockRecord.mockResolvedValue({
      inserted: true,
      record: { eventId: event.id } as never,
    });
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ignored");
    expect(body.received).toBe(true);
    expect(body.eventId).toBe(event.id);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("webhook_returns_500_on_unexpected_error", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    mockVerify.mockReturnValue(SAMPLE_EVENT as never);
    mockRecord.mockRejectedValue(new Error("DB down"));
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("internal error");
  });

  it("webhook_returns_413_prefilter_content_length", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const req = makeRequest({ contentLength: "600000" });
    const textSpy = vi.spyOn(req, "text");
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("payload too large");
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("webhook_returns_413_oversized_body_without_content_length", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    const oversizedBody = "x".repeat(512 * 1024 + 1);
    const req = makeRequest({ body: oversizedBody });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("payload too large");
  });

  it("webhook_passes_prefilter_with_small_content_length", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    mockVerify.mockImplementation(() => {
      throw new StripeServiceError("bad sig", "stripe/invalid_signature");
    });
    const req = makeRequest({ contentLength: "100" });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid request");
  });

  it("webhook_skips_prefilter_on_non_numeric_content_length", async () => {
    vi.stubEnv("STRIPE_WEBHOOKS_ENABLED", "true");
    mockVerify.mockImplementation(() => {
      throw new StripeServiceError("bad sig", "stripe/invalid_signature");
    });
    const req = makeRequest({ contentLength: "abc" });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid request");
  });

  it("middleware_excludes_stripe_webhook_route", async () => {
    const { config } = await import("@/middleware");
    const pattern = config.matcher[0];
    expect(pattern).toContain("api/stripe");
    const negativeGroup = pattern.match(/\(\?!([^)]+)\)/)?.[1] ?? "";
    expect(negativeGroup).toContain("api/stripe");
  });
});
