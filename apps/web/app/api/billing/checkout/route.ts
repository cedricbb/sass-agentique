export const runtime = 'nodejs';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { validateSession, StripeService } from '@saas/services';
import type { CheckoutSessionParams } from '@saas/services';
import { db } from '@saas/db';
import { memberships, tenants, plans } from '@saas/db';
import { eq } from 'drizzle-orm';
import { isAllowedRedirectUrl } from '@saas/config';

const checkoutBodySchema = z.object({
  planId: z.string().uuid(),
  interval: z.enum(['monthly', 'yearly', 'one_time']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

type CheckoutRequestBody = z.infer<typeof checkoutBodySchema>;

interface CheckoutResponse {
  url: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session-token')?.value;
    if (!token) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const sessionUser = await validateSession(token);
    if (!sessionUser) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const [membership] = await db
      .select({ tenantId: memberships.tenantId })
      .from(memberships)
      .where(eq(memberships.userId, sessionUser.id))
      .limit(1);

    if (!membership) {
      return Response.json({ error: 'tenant_not_found' }, { status: 400 });
    }

    const tenantId = membership.tenantId;

    const rawBody = await request.json();
    const parsed = checkoutBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
    }

    const { planId, interval, successUrl, cancelUrl } = parsed.data satisfies CheckoutRequestBody;

    if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
      return Response.json({ error: 'url_not_allowed' }, { status: 400 });
    }

    const [tenant] = await db
      .select({ stripeCustomerId: tenants.stripeCustomerId })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant?.stripeCustomerId) {
      return Response.json({ error: 'stripe_customer_not_found' }, { status: 400 });
    }

    const [plan] = await db
      .select({
        stripePriceIdMonthly: plans.stripePriceIdMonthly,
        stripePriceIdYearly: plans.stripePriceIdYearly,
        stripeProductId: plans.stripeProductId,
        priceMonthlyEurCents: plans.priceMonthlyEurCents,
      })
      .from(plans)
      .where(eq(plans.id, planId));

    if (!plan) {
      return Response.json({ error: 'plan_not_found' }, { status: 400 });
    }

    type CheckoutMode = 'subscription' | 'payment';

    let resolvedPriceId: string | undefined;
    let resolvedProductId: string | undefined;
    let mode: CheckoutMode;

    if (interval === 'monthly') {
      if (!plan.stripePriceIdMonthly) {
        return Response.json({ error: 'plan_not_configured' }, { status: 400 });
      }
      resolvedPriceId = plan.stripePriceIdMonthly;
      mode = 'subscription';
    } else if (interval === 'yearly') {
      if (!plan.stripePriceIdYearly) {
        return Response.json({ error: 'plan_not_configured' }, { status: 400 });
      }
      resolvedPriceId = plan.stripePriceIdYearly;
      mode = 'subscription';
    } else {
      if (!plan.stripeProductId) {
        return Response.json({ error: 'plan_not_configured' }, { status: 400 });
      }
      resolvedProductId = plan.stripeProductId;
      mode = 'payment';
    }

    const params: CheckoutSessionParams =
      mode === 'subscription'
        ? {
            mode: 'subscription',
            stripeCustomerId: tenant.stripeCustomerId,
            clientReferenceId: tenantId,
            successUrl,
            cancelUrl,
            priceId: resolvedPriceId!,
          }
        : {
            mode: 'payment',
            stripeCustomerId: tenant.stripeCustomerId,
            clientReferenceId: tenantId,
            successUrl,
            cancelUrl,
            productId: resolvedProductId!,
            unitAmountCents: plan.priceMonthlyEurCents,
          };

    const stripeService = new StripeService();
    const session = await stripeService.createCheckoutSession(tenantId, params);

    return Response.json({ url: session.url } satisfies CheckoutResponse, { status: 200 });
  } catch (err) {
    console.error('[POST /api/billing/checkout] unexpected error', err);
    return Response.json({ error: 'internal_server_error' }, { status: 500 });
  }
}
