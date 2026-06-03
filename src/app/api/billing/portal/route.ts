// POST /api/billing/portal — open the Stripe Billing Portal to manage/cancel (DEC-021).
import { NextResponse } from 'next/server';
import { requireUser, jsonError, serverError, getAppBase } from '@/lib/api';
import { createPortalSession } from '@/lib/stripe';
import { getOrgStripeCustomerId } from '@/lib/subscription';

export async function POST(req: Request): Promise<NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const customerId = await getOrgStripeCustomerId(user.organization_id);
  if (!customerId) return jsonError('no_subscription', 400);

  const base = getAppBase(req);
  try {
    const url = await createPortalSession(customerId, `${base}/settings`);
    return NextResponse.json({ url });
  } catch (err) {
    return serverError('portal_failed', err, { user: user.id });
  }
}
