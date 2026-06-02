// POST /api/billing/checkout — start a Stripe Checkout for a plan (DEC-021).
// Returns { url } to redirect to. Subscription state is set later by the webhook.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/session';
import { createCheckoutSession } from '@/lib/stripe';
import { getOrgStripeCustomerId } from '@/lib/subscription';
import { isPlanId } from '@/lib/pricing';
import { PUBLIC_ENV } from '@/lib/env';
import { log } from '@/lib/log';

const Body = z.object({ plan: z.string() });

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isPlanId(parsed.data.plan)) {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });
  }

  const base = PUBLIC_ENV.appUrl || new URL(req.url).origin;
  try {
    const url = await createCheckoutSession({
      orgId: user.organization_id,
      plan: parsed.data.plan,
      successUrl: `${base}/dashboard?sub=success`,
      cancelUrl: `${base}/pricing`,
      customerId: await getOrgStripeCustomerId(user.organization_id),
      customerEmail: user.email,
    });
    return NextResponse.json({ url });
  } catch (err) {
    log.error('checkout_failed', { user: user.id, message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
