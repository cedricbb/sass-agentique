import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockEnv = vi.hoisted(() => ({
  STRIPE_WEBHOOKS_ENABLED: true as boolean,
}));

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
import { logger } from "@saas/services/logger";
import { handleStripeWebhook } from "../webhook-handler";

const mockVerify = vi.mocked(verifyWebhookSignature);
const mockRecord = vi.mocked(recordStripeEvent);
const mockSend = vi.mocked(inngest.send);
const mockLogger = {
  error: vi.mocked(logger.error),
  info: vi.mocked(logger.info),
  warn: vi.mocked(logger.warn),
};

function makeRequest(options: {
  body?: string;
  signature?: string | null;
  contentLength?: string | null;
}): NextRequest {
  const {
    body = '{"id":"evt_1","type":"payment_intent.succeeded","object":"event"}',
    signature = "t=12345,v1=abc",
    contentLength = undefined,
  } = options;

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
  mockEnv.STRIPE_WEBHOOKS_ENABLED = true;
});

describe("handleStripeWebhook", () => {
  it("returns 503 when webhooks disabled", async () => {
    mockEnv.STRIPE_WEBHOOKS_ENABLED = false;
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("service unavailable");
  });

  it("webhook_returns_400_when_signature_header_missing", async () => {
    const req = makeRequest({ signature: null });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("missing signature");
  });

  it("webhook_returns_400_when_body_empty", async () => {
    const req = makeRequest({ body: "" });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("empty body");
  });

  it("webhook_returns_413_when_payload_too_large", async () => {
    const oversizedBody = "x".repeat(512 * 1024 + 1);
    const req = makeRequest({ body: oversizedBody });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("payload too large");
  });

  it("webhook_returns_400_on_invalid_signature_without_leaking_error", async () => {
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

  it("dispatches inngest event for payment_intent.succeeded", async () => {
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
    mockVerify.mockReturnValue(SAMPLE_EVENT as never);
    mockRecord.mockRejectedValue(new Error("DB down"));
    const req = makeRequest({});
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("internal error");
  });

  it("webhook_returns_413_prefilter_content_length", async () => {
    const req = makeRequest({ contentLength: "600000" });
    const textSpy = vi.spyOn(req, "text");
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("payload too large");
    expect(textSpy).not.toHaveBeenCalled();
  });

  it("webhook_returns_413_oversized_body_without_content_length", async () => {
    const oversizedBody = "x".repeat(512 * 1024 + 1);
    const req = makeRequest({ body: oversizedBody });
    const res = await handleStripeWebhook(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("payload too large");
  });

  it("webhook_passes_prefilter_with_small_content_length", async () => {
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

  it("webhook_logs_dispatched_on_succeeded", async () => {
    const event = { ...SAMPLE_EVENT, type: "payment_intent.succeeded" };
    mockVerify.mockReturnValue(event as never);
    mockRecord.mockResolvedValue({ inserted: true, record: { eventId: event.id } as never });
    mockSend.mockResolvedValue(undefined as never);
    const req = makeRequest({});
    await handleStripeWebhook(req);
    expect(mockLogger.info).toHaveBeenCalledWith("webhook.stripe.dispatched", {
      eventId: event.id,
      eventType: event.type,
    });
  });

  it("webhook_logs_warn_on_invalid_signature", async () => {
    const sigError = new StripeServiceError("bad sig", "stripe/invalid_signature");
    mockVerify.mockImplementation(() => { throw sigError; });
    const req = makeRequest({});
    await handleStripeWebhook(req);
    expect(mockLogger.warn).toHaveBeenCalledWith("webhook.stripe.signature_invalid", { err: sigError });
  });

  it("webhook_logs_duplicate_on_replay", async () => {
    mockVerify.mockReturnValue(SAMPLE_EVENT as never);
    mockRecord.mockResolvedValue({ inserted: false, record: { eventId: SAMPLE_EVENT.id } as never });
    const req = makeRequest({});
    await handleStripeWebhook(req);
    expect(mockLogger.info).toHaveBeenCalledWith("webhook.stripe.duplicate", {
      eventId: SAMPLE_EVENT.id,
      eventType: SAMPLE_EVENT.type,
    });
  });

  it("webhook_logs_error_on_unexpected_exception", async () => {
    const dbError = new Error("DB down");
    mockVerify.mockReturnValue(SAMPLE_EVENT as never);
    mockRecord.mockRejectedValue(dbError);
    const req = makeRequest({});
    await handleStripeWebhook(req);
    expect(mockLogger.error).toHaveBeenCalledWith("webhook.stripe.error", {
      eventId: SAMPLE_EVENT.id,
      eventType: SAMPLE_EVENT.type,
      err: dbError,
    });
  });

  it("webhook_logs_disabled_when_webhooks_off", async () => {
    mockEnv.STRIPE_WEBHOOKS_ENABLED = false;
    const req = makeRequest({});
    await handleStripeWebhook(req);
    expect(mockLogger.warn).toHaveBeenCalledWith("webhook.stripe.disabled");
  });

  it("webhook_no_console_calls_on_happy_path", async () => {
    const event = { ...SAMPLE_EVENT, type: "payment_intent.succeeded" };
    mockVerify.mockReturnValue(event as never);
    mockRecord.mockResolvedValue({ inserted: true, record: { eventId: event.id } as never });
    mockSend.mockResolvedValue(undefined as never);
    const consoleSpy = vi.spyOn(console, "error");
    const consoleWarnSpy = vi.spyOn(console, "warn");
    const consoleInfoSpy = vi.spyOn(console, "info");
    const req = makeRequest({});
    await handleStripeWebhook(req);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });
});
