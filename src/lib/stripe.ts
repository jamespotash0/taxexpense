// Stripe integration (DEC-021). PWA billing — no App Store cut. Server-only.
import Stripe from 'stripe';
import { requireEnv, optionalEnv } from './env';
import { PLANS, type PlanId } from './pricing';
import type { SubStatus } from './subscription';

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));
  return _stripe;
}

/** Map a Stripe subscription status to our internal status. */
export function mapStripeStatus(s: Stripe.Subscription.Status): SubStatus {
  switch (s) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'incomplete':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'expired';
  }
}

/** Create a Checkout Session for a plan. client_reference_id links it back to the org. */
export async function createCheckoutSession(args: {
  orgId: string;
  plan: PlanId;
  successUrl: string;
  cancelUrl: string;
  customerId?: string | null;
  customerEmail?: string | null;
}): Promise<string> {
  const priceId = requireEnv(PLANS[args.plan].stripePriceEnv);
  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.orgId,
    metadata: { orgId: args.orgId, plan: args.plan },
    ...(args.customerId ? { customer: args.customerId } : args.customerEmail ? { customer_email: args.customerEmail } : {}),
    allow_promotion_codes: true,
  });
  if (!session.url) throw new Error('stripe_no_checkout_url');
  return session.url;
}

/** Create a Billing Portal session so the user can manage/cancel. */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}

/** Verify + parse a Stripe webhook event. */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(payload, signature, requireEnv('STRIPE_WEBHOOK_SECRET'));
}

/**
 * Current period end (ISO) from a Subscription. In recent Stripe API versions this lives
 * on the subscription's line items, not the subscription itself.
 */
export function periodEndFromSubscription(sub: Stripe.Subscription): string | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

/** Period end (ISO) for a subscription id, for current_period_end tracking. */
export async function getSubscriptionPeriodEnd(subscriptionId: string): Promise<string | null> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  return periodEndFromSubscription(sub);
}

export const stripeConfigured = (): boolean => !!optionalEnv('STRIPE_SECRET_KEY');
