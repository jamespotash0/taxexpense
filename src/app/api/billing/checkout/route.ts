// POST /api/billing/checkout — start a Stripe Checkout for a plan (DEC-021).
// Returns { url } to redirect to. Subscription state is set later by the webhook.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, jsonError, serverError, getAppBase } from '@/lib/api';
import { createCheckoutSession } from '@/lib/stripe';
import { getOrgStripeCustomerId } from '@/lib/subscription';
import { isPlanId } from '@/lib/pricing';

const Body = z.object({ plan: z.string() });

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isPlanId(parsed.data.plan)) {
    return jsonError('invalid_plan', 400);
  }

  const base = getAppBase(req);
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
    return serverError('checkout_failed', err, { user: user.id });
  }
}
