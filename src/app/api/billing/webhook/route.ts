// POST /api/billing/webhook — Stripe webhook (DEC-021). Verifies signature, then
// syncs subscription state onto the org. Configure this URL in the Stripe dashboard
// and set STRIPE_WEBHOOK_SECRET. Never trust the body without verifying the signature.
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructWebhookEvent, mapStripeStatus, getSubscriptionPeriodEnd, periodEndFromSubscription } from '@/lib/stripe';
import { updateOrgBilling, getOrgIdByStripeCustomer } from '@/lib/subscription';
import { isPlanId } from '@/lib/pricing';
import { log } from '@/lib/log';

export async function POST(req: Request): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new NextResponse('missing signature', { status: 400 });

  const payload = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, sig);
  } catch (err) {
    log.warn('stripe_signature_invalid', { message: err instanceof Error ? err.message : 'unknown' });
    return new NextResponse('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const orgId = s.client_reference_id ?? (s.metadata?.orgId as string | undefined);
        const subId = typeof s.subscription === 'string' ? s.subscription : undefined;
        const customerId = typeof s.customer === 'string' ? s.customer : undefined;
        const plan = s.metadata?.plan;
        if (orgId) {
          await updateOrgBilling(orgId, {
            subscription_status: 'active',
            ...(plan && isPlanId(plan) ? { plan } : {}),
            ...(customerId ? { stripe_customer_id: customerId } : {}),
            ...(subId ? { stripe_subscription_id: subId } : {}),
            current_period_end: subId ? await getSubscriptionPeriodEnd(subId) : null,
          });
          log.info('subscription_activated', { org: orgId });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const orgId = await getOrgIdByStripeCustomer(customerId);
        if (orgId) {
          await updateOrgBilling(orgId, {
            subscription_status: event.type.endsWith('deleted') ? 'canceled' : mapStripeStatus(sub.status),
            current_period_end: periodEndFromSubscription(sub),
          });
          log.info('subscription_synced', { org: orgId, status: sub.status });
        }
        break;
      }
      default:
        break; // ignore other event types
    }
  } catch (err) {
    log.error('stripe_webhook_handler_failed', { type: event.type, message: err instanceof Error ? err.message : 'unknown' });
    // 200 anyway so Stripe doesn't hammer retries on a transient DB blip we've logged.
  }

  return NextResponse.json({ received: true });
}
