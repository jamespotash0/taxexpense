// Subscription / entitlement logic (DEC-021). Pure computeEntitlement() so it's fully
// unit-testable; the DB loader is the only side effect. "Entitled" = may use the product.

import { getSupabaseAdmin } from './supabase';

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | null;

export interface OrgBilling {
  trial_ends_at: string | null;
  subscription_status: SubStatus;
  current_period_end: string | null;
}

export interface Entitlement {
  entitled: boolean;
  reason: 'active' | 'trialing' | 'expired' | 'none';
  trialDaysLeft: number; // 0 if not trialing / expired
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure: decide whether an org may use the product right now. */
export function computeEntitlement(org: OrgBilling, now: Date): Entitlement {
  // Paid + within the current period → entitled.
  if (org.subscription_status === 'active') {
    const end = org.current_period_end ? new Date(org.current_period_end) : null;
    if (!end || end > now) return { entitled: true, reason: 'active', trialDaysLeft: 0 };
    return { entitled: false, reason: 'expired', trialDaysLeft: 0 };
  }

  // Trialing → entitled until trial_ends_at.
  if (org.trial_ends_at) {
    const ends = new Date(org.trial_ends_at);
    if (ends > now) {
      const daysLeft = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY_MS));
      return { entitled: true, reason: 'trialing', trialDaysLeft: daysLeft };
    }
    return { entitled: false, reason: 'expired', trialDaysLeft: 0 };
  }

  // past_due / canceled / unknown → not entitled.
  return { entitled: false, reason: org.subscription_status ? 'expired' : 'none', trialDaysLeft: 0 };
}

/** Load an org's billing row and compute entitlement (now). */
export async function getOrgEntitlement(orgId: string): Promise<Entitlement> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('trial_ends_at, subscription_status, current_period_end')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { entitled: false, reason: 'none', trialDaysLeft: 0 };
  return computeEntitlement(data as OrgBilling, new Date());
}

export interface OrgBillingPatch {
  subscription_status?: SubStatus;
  plan?: 'monthly' | 'annual';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string | null;
}

/** Update an org's billing fields (called from the Stripe webhook). */
export async function updateOrgBilling(orgId: string, patch: OrgBillingPatch): Promise<void> {
  const { error } = await getSupabaseAdmin().from('organizations').update(patch).eq('id', orgId);
  if (error) throw error;
}

/** Resolve a Stripe customer id back to our org id (for subscription.* webhooks). */
export async function getOrgIdByStripeCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** Read an org's stripe_customer_id (for the billing portal). */
export async function getOrgStripeCustomerId(orgId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (data?.stripe_customer_id as string | undefined) ?? null;
}
