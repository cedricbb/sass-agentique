import { type NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  recordStripeEvent,
  StripeServiceError,
} from "@saas/services";
import { inngest } from "@saas/workflows";

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
  if (process.env.STRIPE_WEBHOOKS_ENABLED !== "true") {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  if (!rawBody) {
    return NextResponse.json({ error: "empty body" }, { status: 400 });
  }

  if (rawBody.length > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let stripeEvent;
  try {
    stripeEvent = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    if (err instanceof StripeServiceError) {
      if (err.code === "stripe/config_error") {
        console.error(
          JSON.stringify({
            event: "stripe-webhook",
            outcome: "config_error",
            message: err.message,
          }),
        );
        return NextResponse.json(
          { error: "service unavailable" },
          { status: 503 },
        );
      }
      console.error(
        JSON.stringify({
          event: "stripe-webhook",
          outcome: "invalid_signature",
          message: err.message,
        }),
      );
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        event: "stripe-webhook",
        outcome: "unexpected_verify_error",
        message,
      }),
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }

  try {
    const { inserted } = await recordStripeEvent({
      eventId: stripeEvent.id,
      type: stripeEvent.type,
      payload: stripeEvent,
    });

    if (!inserted) {
      return NextResponse.json(
        { received: true, eventId: stripeEvent.id, status: "already_processed" },
        { status: 200 },
      );
    }

    if (!isDispatchedEventType(stripeEvent.type)) {
      console.error(
        JSON.stringify({
          event: "stripe-webhook",
          outcome: "ignored",
          eventId: stripeEvent.id,
          message: `unhandled event type: ${stripeEvent.type}`,
        }),
      );
      return NextResponse.json(
        { received: true, eventId: stripeEvent.id, status: "ignored" },
        { status: 200 },
      );
    }

    await inngest.send({
      name: INNGEST_EVENT_NAMES[stripeEvent.type],
      data: { event: stripeEvent },
    });

    return NextResponse.json(
      { received: true, eventId: stripeEvent.id, status: "dispatched" },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        event: "stripe-webhook",
        outcome: "internal_error",
        eventId: stripeEvent.id,
        message,
      }),
    );
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
