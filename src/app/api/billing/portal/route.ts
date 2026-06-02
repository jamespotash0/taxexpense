// POST /api/billing/portal — open the Stripe Billing Portal to manage/cancel (DEC-021).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { createPortalSession } from '@/lib/stripe';
import { getOrgStripeCustomerId } from '@/lib/subscription';
import { PUBLIC_ENV } from '@/lib/env';
import { log } from '@/lib/log';

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const customerId = await getOrgStripeCustomerId(user.organization_id);
  if (!customerId) return NextResponse.json({ error: 'no_subscription' }, { status: 400 });

  const base = PUBLIC_ENV.appUrl || new URL(req.url).origin;
  try {
    const url = await createPortalSession(customerId, `${base}/settings`);
    return NextResponse.json({ url });
  } catch (err) {
    log.error('portal_failed', { user: user.id, message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
