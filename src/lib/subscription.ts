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

// --- Proactive trial reminders (DEC-061) -------------------------------------------------------

/** Days before expiry to send the "ending soon" nudge. */
export const TRIAL_ENDING_SOON_DAYS = 3;

export type TrialReminderKind = 'ending' | 'ended';

export interface TrialReminderRow {
  id: string;
  owner_user_id: string | null;
  trial_ends_at: string | null;
  subscription_status: SubStatus;
  trial_ending_reminder_at: string | null;
  trial_ended_reminder_at: string | null;
}

/**
 * Pure: which trial reminder (if any) is due for an org right now. Sends "ending" once within the
 * window before expiry, and "ended" once at/after expiry — each gated by its own stamp so the daily
 * cron never re-texts. Only trialing orgs qualify (a subscriber's status is 'active').
 */
export function trialReminderDue(org: TrialReminderRow, now: Date): TrialReminderKind | null {
  if (org.subscription_status !== 'trialing' || !org.trial_ends_at) return null;
  const ends = new Date(org.trial_ends_at).getTime();
  if (ends <= now.getTime()) {
    return org.trial_ended_reminder_at ? null : 'ended';
  }
  const msLeft = ends - now.getTime();
  if (msLeft <= TRIAL_ENDING_SOON_DAYS * DAY_MS) {
    return org.trial_ending_reminder_at ? null : 'ending';
  }
  return null;
}

/** Trialing orgs whose trial ends within the look-ahead window or has already lapsed (cron scan). */
export async function listTrialingForReminder(now: Date): Promise<TrialReminderRow[]> {
  const horizon = new Date(now.getTime() + TRIAL_ENDING_SOON_DAYS * DAY_MS).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('id, owner_user_id, trial_ends_at, subscription_status, trial_ending_reminder_at, trial_ended_reminder_at')
    .eq('subscription_status', 'trialing')
    .not('trial_ends_at', 'is', null)
    .lte('trial_ends_at', horizon);
  if (error) throw error;
  return (data as TrialReminderRow[]) ?? [];
}

/** Stamp the reminder we just sent so it's never re-sent (idempotency). */
export async function stampTrialReminder(orgId: string, kind: TrialReminderKind): Promise<void> {
  const col = kind === 'ending' ? 'trial_ending_reminder_at' : 'trial_ended_reminder_at';
  const { error } = await getSupabaseAdmin()
    .from('organizations')
    .update({ [col]: new Date().toISOString() })
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
