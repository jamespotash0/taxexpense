// Subscription / entitlement logic (DEC-021). Pure computeEntitlement() so it's fully
// unit-testable; the DB loader is the only side effect. "Entitled" = may use the product.

import { getSupabaseAdmin } from './supabase';
import type { PlanId } from './pricing';

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

/**
 * Pure: an AGENCY-managed creator's entitlement (Spec 10, Fix 3). The creator never pays; coverage
 * flows from the agency's status (set by hand for the first agencies, automated per-seat later).
 * 'active'/'trialing' → covered; anything else → not. No trial countdown is surfaced to a managed
 * creator (they don't see billing), so trialDaysLeft is always 0.
 */
export function computeAgencyEntitlement(status: SubStatus): Entitlement {
  if (status === 'active' || status === 'trialing') {
    return { entitled: true, reason: status === 'active' ? 'active' : 'trialing', trialDaysLeft: 0 };
  }
  return { entitled: false, reason: status ? 'expired' : 'none', trialDaysLeft: 0 };
}

/** Load an agency's billing status and compute its entitlement. */
export async function getAgencyEntitlement(agencyId: string): Promise<Entitlement> {
  const { data, error } = await getSupabaseAdmin()
    .from('agencies')
    .select('subscription_status')
    .eq('id', agencyId)
    .maybeSingle();
  if (error) throw error;
  return computeAgencyEntitlement((data?.subscription_status as SubStatus) ?? null);
}

/** Load an org's billing row and compute entitlement (now). Managed creator orgs (Spec 10) inherit
 *  the AGENCY's entitlement instead of their own — they never have their own subscription/trial. */
export async function getOrgEntitlement(orgId: string): Promise<Entitlement> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('agency_id, trial_ends_at, subscription_status, current_period_end')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { entitled: false, reason: 'none', trialDaysLeft: 0 };
  if (data.agency_id) return getAgencyEntitlement(data.agency_id as string);
  return computeEntitlement(data as OrgBilling, new Date());
}

export interface OrgBillingPatch {
  subscription_status?: SubStatus;
  plan?: PlanId;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string | null;
}

/** Update an org's billing fields (called from the Stripe webhook). */
export async function updateOrgBilling(orgId: string, patch: OrgBillingPatch): Promise<void> {
  const { error } = await getSupabaseAdmin().from('organizations').update(patch).eq('id', orgId);
  if (error) throw error;
}

// --- Proactive trial-expiry notice (DEC-061, narrowed by DEC-079) ------------------------------
// We notify ONLY after the trial has actually lapsed — no "ending soon" nudges during the trial.
// The trial-start is announced on the user's first text; the cron then stays quiet until expiry.

export type TrialReminderKind = 'ended';

export interface TrialReminderRow {
  id: string;
  owner_user_id: string | null;
  trial_ends_at: string | null;
  subscription_status: SubStatus;
  trial_ended_reminder_at: string | null;
}

/**
 * Pure: is the one-time "trial ended" notice due for an org right now? Fires once at/after expiry,
 * gated by its stamp so the daily cron never re-texts. Only trialing orgs qualify (a subscriber's
 * status is 'active'). No pre-expiry nudge by design (DEC-079).
 */
export function trialReminderDue(org: TrialReminderRow, now: Date): TrialReminderKind | null {
  if (org.subscription_status !== 'trialing' || !org.trial_ends_at) return null;
  const ends = new Date(org.trial_ends_at).getTime();
  if (ends <= now.getTime()) {
    return org.trial_ended_reminder_at ? null : 'ended';
  }
  return null;
}

/** Trialing orgs whose trial has already lapsed and haven't been told yet (cron scan). */
export async function listTrialingForReminder(now: Date): Promise<TrialReminderRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('id, owner_user_id, trial_ends_at, subscription_status, trial_ended_reminder_at')
    .eq('subscription_status', 'trialing')
    .not('trial_ends_at', 'is', null)
    .lte('trial_ends_at', now.toISOString());
  if (error) throw error;
  return (data as TrialReminderRow[]) ?? [];
}

/** Stamp the "ended" notice we just sent so it's never re-sent (idempotency). */
export async function stampTrialReminder(orgId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('organizations')
    .update({ trial_ended_reminder_at: new Date().toISOString() })
    .eq('id', orgId);
  if (error) throw error;
}

/**
 * Atomically CLAIM the right to send the one-time subscribe-welcome (DEC-060). Returns true exactly
 * once per org — the first caller to flip `subscription_welcomed_at` from NULL wins; all later
 * callers (Stripe webhook retries, renewals) get false. Race-safe: the `.is(null)` filter + UPDATE
 * is a single atomic row update in Postgres, so concurrent deliveries serialize and only one wins.
 */
export async function claimSubscriptionWelcome(orgId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .update({ subscription_welcomed_at: new Date().toISOString() })
    .eq('id', orgId)
    .is('subscription_welcomed_at', null)
    .select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
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
