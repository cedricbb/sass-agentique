export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { validateSession, StripeService } from '@saas/services';
import { db } from '@saas/db';
import { memberships, tenants } from '@saas/db';
import { eq } from 'drizzle-orm';

export async function POST(): Promise<Response> {
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

    const [tenant] = await db
      .select({ stripeCustomerId: tenants.stripeCustomerId })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant?.stripeCustomerId) {
      return Response.json({ error: 'stripe_customer_not_found' }, { status: 400 });
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`;
    const stripeService = new StripeService();
    const session = await stripeService.createPortalSession(tenantId, tenant.stripeCustomerId, returnUrl);

    return Response.json({ url: session.url }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/billing/portal] unexpected error', err);
    return Response.json({ error: 'internal_error' }, { status: 500 });
  }
}
