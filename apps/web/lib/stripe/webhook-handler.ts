import { type NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  recordStripeEvent,
  StripeServiceError,
} from "@saas/services";
import { logger } from "@saas/services/logger";
import { inngest } from "@saas/workflows";
import { env } from "@saas/config";

const MAX_WEBHOOK_PAYLOAD_BYTES = 512 * 1024;

const DISPATCHED_EVENT_TYPES = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
] as const;

type DispatchedEventType = (typeof DISPATCHED_EVENT_TYPES)[number];

function isDispatchedEventType(type: string): type is DispatchedEventType {
  return (DISPATCHED_EVENT_TYPES as readonly string[]).includes(type);
}

const INNGEST_EVENT_NAMES: Record<DispatchedEventType, string> = {
  "payment_intent.succeeded": "stripe/payment-intent.succeeded",
  "payment_intent.payment_failed": "stripe/payment-intent.failed",
};

export async function handleStripeWebhook(
  request: NextRequest,
): Promise<NextResponse> {
  if (!env.STRIPE_WEBHOOKS_ENABLED) {
    logger.warn("webhook.stripe.disabled");
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredBytes = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_WEBHOOK_PAYLOAD_BYTES) {
      logger.warn("webhook.stripe.body_too_large", { declaredBytes });
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    logger.warn("webhook.stripe.signature_invalid");
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  if (!rawBody) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_PAYLOAD_BYTES) {
    logger.warn("webhook.stripe.body_too_large");
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let stripeEvent;
  try {
    stripeEvent = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    if (err instanceof StripeServiceError) {
      if (err.code === "stripe/config_error") {
        logger.error("webhook.stripe.error", { err });
        return NextResponse.json(
          { error: "service unavailable" },
          { status: 503 },
        );
      }
      logger.warn("webhook.stripe.signature_invalid", { err });
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    logger.error("webhook.stripe.error", { err: err instanceof Error ? err : new Error(String(err)) });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  try {
    const { inserted } = await recordStripeEvent({
      eventId: stripeEvent.id,
      type: stripeEvent.type,
      payload: stripeEvent,
    });

    if (!inserted) {
      logger.info("webhook.stripe.duplicate", { eventId: stripeEvent.id, eventType: stripeEvent.type });
      return NextResponse.json(
        { received: true, eventId: stripeEvent.id, status: "already_processed" },
        { status: 200 },
      );
    }

    if (!isDispatchedEventType(stripeEvent.type)) {
      logger.info("webhook.stripe.ignored", { eventId: stripeEvent.id, eventType: stripeEvent.type });
      return NextResponse.json(
        { received: true, eventId: stripeEvent.id, status: "ignored" },
        { status: 200 },
      );
    }

    await inngest.send({
      name: INNGEST_EVENT_NAMES[stripeEvent.type],
      data: { event: stripeEvent },
    });

    logger.info("webhook.stripe.dispatched", { eventId: stripeEvent.id, eventType: stripeEvent.type });
    return NextResponse.json(
      { received: true, eventId: stripeEvent.id, status: "dispatched" },
      { status: 200 },
    );
  } catch (err) {
    logger.error("webhook.stripe.error", { eventId: stripeEvent.id, eventType: stripeEvent.type, err: err instanceof Error ? err : new Error(String(err)) });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
