export const runtime = 'nodejs';

import Stripe from 'stripe';
import { SubscriptionService, type StripeSubscriptionEvent } from '@saas/services';
import { type SubscriptionStatus } from '@saas/db';
import { inngest } from '@saas/workflows';

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  items: {
    data: Array<{
      price: { id: string };
    }>;
  };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
}

interface StripeInvoiceObject {
  id: string;
  customer: string;
  subscription: string | null;
  metadata: Record<string, string>;
}

function buildStripeFromEnv(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not defined');
  }
  return new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
}

function resolveSubscriptionTenantId(sub: StripeSubscriptionObject): string {
  return sub.metadata.tenantId;
}

async function resolveInvoiceTenantId(
  stripe: Stripe,
  invoice: StripeInvoiceObject
): Promise<string | null> {
  if (!invoice.subscription) {
    console.warn('[webhook/stripe] invoice has no subscription id', { invoiceId: invoice.id });
    return null;
  }
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  return subscription.metadata.tenantId ?? null;
}

function mapSubscriptionPayload(
  sub: StripeSubscriptionObject,
  forceStatus?: SubscriptionStatus
): StripeSubscriptionEvent {
  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: sub.customer,
    stripePriceId: sub.items.data[0].price.id,
    status: forceStatus ?? (sub.status as SubscriptionStatus),
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

async function handleSubscriptionEvent(
  _stripe: Stripe,
  subscriptionService: SubscriptionService,
  event: Stripe.Event,
  forceStatus?: SubscriptionStatus
): Promise<void> {
  try {
    const sub = event.data.object as StripeSubscriptionObject;
    const tenantId = resolveSubscriptionTenantId(sub);
    console.info('[webhook/stripe] handling subscription event', { type: event.type, id: event.id, tenantId });
    const payload = mapSubscriptionPayload(sub, forceStatus);
    await subscriptionService.upsertFromStripeEvent(tenantId, payload);
  } catch (err) {
    console.error('[webhook/stripe] handleSubscriptionEvent error', { type: event.type, id: event.id, error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleInvoicePaymentFailed(
  stripe: Stripe,
  subscriptionService: SubscriptionService,
  event: Stripe.Event
): Promise<void> {
  try {
    const invoice = event.data.object as StripeInvoiceObject;
    const tenantId = await resolveInvoiceTenantId(stripe, invoice);
    if (!tenantId) return;

    console.info('[webhook/stripe] handling invoice.payment_failed', { id: event.id, tenantId });

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const sub = subscription as unknown as StripeSubscriptionObject;
    const payload = mapSubscriptionPayload(sub);
    await subscriptionService.upsertFromStripeEvent(tenantId, payload);

    await inngest.send({
      name: 'subscription/payment.failed',
      data: { tenantId, invoiceId: invoice.id },
    });
  } catch (err) {
    console.error('[webhook/stripe] handleInvoicePaymentFailed error', { id: event.id, error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleInvoicePaymentSucceeded(
  stripe: Stripe,
  subscriptionService: SubscriptionService,
  event: Stripe.Event
): Promise<void> {
  try {
    const invoice = event.data.object as StripeInvoiceObject;
    const tenantId = await resolveInvoiceTenantId(stripe, invoice);
    if (!tenantId) return;

    console.info('[webhook/stripe] handling invoice.payment_succeeded', { id: event.id, tenantId });

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const sub = subscription as unknown as StripeSubscriptionObject;
    const payload = mapSubscriptionPayload(sub);
    await subscriptionService.upsertFromStripeEvent(tenantId, payload);
  } catch (err) {
    console.error('[webhook/stripe] handleInvoicePaymentSucceeded error', { id: event.id, error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleTrialWillEnd(event: Stripe.Event): Promise<void> {
  try {
    const sub = event.data.object as StripeSubscriptionObject;
    const tenantId = resolveSubscriptionTenantId(sub);
    console.info('[webhook/stripe] handling customer.subscription.trial_will_end', { id: event.id, tenantId });
    await inngest.send({
      name: 'subscription/trial.ending',
      data: { tenantId, subscriptionId: sub.id },
    });
  } catch (err) {
    console.error('[webhook/stripe] handleTrialWillEnd error', { id: event.id, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');

  const stripe = buildStripeFromEnv();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook/stripe] STRIPE_WEBHOOK_SECRET is not defined');
    return new Response(null, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig ?? '', webhookSecret);
  } catch (err) {
    console.error('[webhook/stripe] signature verification failed', { error: err instanceof Error ? err.message : String(err) });
    return new Response(null, { status: 400 });
  }

  console.info('[webhook/stripe]', { type: event.type, id: event.id });

  try {
    const subscriptionService = new SubscriptionService();

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionEvent(stripe, subscriptionService, event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(stripe, subscriptionService, event, 'canceled' as SubscriptionStatus);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripe, subscriptionService, event);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(stripe, subscriptionService, event);
        break;
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event);
        break;
      default:
        console.info('[webhook/stripe] event ignored', { type: event.type, id: event.id });
    }
  } catch (err) {
    console.error('[webhook/stripe] POST handler error', { type: event.type, id: event.id, error: err instanceof Error ? err.message : String(err) });
  }

  return new Response(null, { status: 200 });
}
