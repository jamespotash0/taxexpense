// GET /api/billing/subscribe-link?t=<token> — one-tap subscribe from an SMS (DEC-062). Verifies the
// signed token (which carries the org id), opens a Stripe Checkout for the default plan, and 302s
// straight there — NO login/OTP, because the token is the proof of identity. Any failure (bad /
// expired token, no signing secret, Stripe error) degrades gracefully to /pricing.

import { NextResponse } from 'next/server';
import { verifySubscribeToken } from '@/lib/subscribe-link';
import { createCheckoutSession } from '@/lib/stripe';
import { getOrgStripeCustomerId } from '@/lib/subscription';
import { getAppBase } from '@/lib/api';
import { log } from '@/lib/log';

// The plan we want one-tap subscribers on (the annual, per DEC-044). The /pricing page remains the
// place to pick the weekly decoy.
const DEFAULT_PLAN = 'annual' as const;

export async function GET(req: Request): Promise<NextResponse> {
  const base = getAppBase(req);
  const token = new URL(req.url).searchParams.get('t') ?? '';

  // The org id comes ONLY from the verified token — never from the URL.
  const orgId = verifySubscribeToken(token);
  if (!orgId) {
    log.info('subscribe_link_invalid'); // no PII; could be expired/tampered/secret-not-set
    return NextResponse.redirect(`${base}/pricing`, 302);
  }

  try {
    const checkoutUrl = await createCheckoutSession({
      orgId,
      plan: DEFAULT_PLAN,
      successUrl: `${base}/dashboard?sub=success`,
      cancelUrl: `${base}/pricing`,
      customerId: await getOrgStripeCustomerId(orgId),
      // Email is optional — Stripe Checkout collects it if we don't have one (DEC-014).
    });
    return NextResponse.redirect(checkoutUrl, 302);
  } catch (err) {
    log.error('subscribe_link_checkout_failed', { org: orgId, message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.redirect(`${base}/pricing`, 302);
  }
}
