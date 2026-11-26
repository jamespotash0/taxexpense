// POST /api/billing/webhook — Stripe webhook (DEC-021). Verifies signature, then
// syncs subscription state onto the org. Configure this URL in the Stripe dashboard
// and set STRIPE_WEBHOOK_SECRET. Never trust the body without verifying the signature.
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, constructWebhookEvent, mapStripeStatus, getSubscriptionPeriodEnd, periodEndFromSubscription } from '@/lib/stripe';
import { updateOrgBilling, getOrgForStripeSubscription } from '@/lib/subscription';
import { sendSubscriptionWelcome } from '@/lib/billing-notify';
import { isPlanId } from '@/lib/pricing';
import { log } from '@/lib/log';
import { claimWebhookEvent, releaseWebhookEvent } from '@/lib/idempotency';

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

  const claimId = `stripe:${event.id}`;
  if (!(await claimWebhookEvent(claimId))) return NextResponse.json({ received: true, duplicate: true });

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
          // One-time welcome. Idempotency is handled inside (atomic claim), so retries of this
          // same event are safe; renewals are subscription.updated and never reach here. Best-effort
          // — a failed welcome must never fail the webhook (Stripe would just retry).
          await sendSubscriptionWelcome(orgId).catch((err) =>
            log.warn('subscription_welcome_failed', { org: orgId, message: err instanceof Error ? err.message : 'unknown' }),
          );
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const evSub = event.data.object as Stripe.Subscription;
        const customerId = typeof evSub.customer === 'string' ? evSub.customer : evSub.customer.id;
        const org = await getOrgForStripeSubscription(customerId, evSub.metadata?.orgId);
        if (!org) break;
        // An event about an old subscription (the org has since resubscribed) must not touch the
        // current one's status.
        if (org.stripe_subscription_id && org.stripe_subscription_id !== evSub.id) break;
        // Stripe doesn't guarantee delivery order, so apply the subscription's CURRENT state
        // rather than the event snapshot: a late "updated: active" can't revive a canceled plan.
        const sub = await getStripe().subscriptions.retrieve(evSub.id);
        await updateOrgBilling(org.id, {
          subscription_status: mapStripeStatus(sub.status),
          current_period_end: periodEndFromSubscription(sub),
          ...(org.stripe_subscription_id ? {} : { stripe_subscription_id: sub.id, stripe_customer_id: customerId }),
        });
        log.info('subscription_synced', { org: org.id, status: sub.status });
        break;
      }
      default:
        break; // ignore other event types
    }
  } catch (err) {
    log.error('stripe_webhook_handler_failed', { type: event.type, message: err instanceof Error ? err.message : 'unknown' });
    await releaseWebhookEvent(claimId).catch(() => {}); // let the retry be processed
    // 500 so Stripe retries (with backoff). Acking a failed activation would leave a paying
    // customer un-entitled forever; the handlers are idempotent, so a retry is safe.
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
