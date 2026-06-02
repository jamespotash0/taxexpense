// User + organization lookup/creation (TSNAP-016).
// V1 is 1:1 user:org. Users are created on first inbound SMS (SMS-first, DEC-006).
// All access via service-role admin client (users/orgs are not orgTable-scoped on
// creation since we don't yet know the org).

import { getSupabaseAdmin } from './supabase';
import { log } from './log';
import { maskPhone } from './log';

export interface AppUser {
  id: string;
  organization_id: string;
  phone_number: string;
  full_name: string | null;
  email: string | null; // collected at the dashboard, not over SMS (DEC-014)
  business_type: string | null;
  entity_type: 'sole_prop' | 'smllc' | 'unknown' | null;
  default_payment_account: 'business' | 'personal' | 'unknown' | null;
  accountant_email: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  sms_consent_at: string | null;
  sms_opted_out_at: string | null;
}

/** Look up a user by E.164 phone. Returns null if not found. */
export async function getUserByPhone(phoneE164: string): Promise<AppUser | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('*')
    .eq('phone_number', phoneE164)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUser | null) ?? null;
}

/**
 * Get an existing user by phone, or create the user + their organization (1:1).
 * Returns the user and whether it was newly created.
 * TCPA: first inbound SMS is the opt-in signal — we stamp sms_consent_at on create.
 */
export async function getOrCreateUserByPhone(
  phoneE164: string,
): Promise<{ user: AppUser; isNew: boolean }> {
  const existing = await getUserByPhone(phoneE164);
  if (existing) return { user: existing, isNew: false };

  const admin = getSupabaseAdmin();

  // 1. Create the organization with a fresh 21-day trial (DEC-021 hybrid paywall).
  const trialEndsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ subscription_tier: 'free', subscription_status: 'trialing', trial_ends_at: trialEndsAt })
    .select('id')
    .single();
  if (orgErr) throw orgErr;

  // 2. Create the user in that org. First inbound SMS = TCPA consent timestamp.
  const { data: user, error: userErr } = await admin
    .from('users')
    .insert({
      organization_id: org.id,
      phone_number: phoneE164,
      onboarding_completed: false,
      onboarding_step: 0,
      sms_consent_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (userErr) throw userErr;

  // 3. Backfill org owner + an owner role (best-effort; non-fatal).
  await admin.from('organizations').update({ owner_user_id: user.id }).eq('id', org.id);
  await admin.from('user_roles').insert({ user_id: user.id, organization_id: org.id, role: 'owner' });

  log.info('user_created', { org: org.id, phone: maskPhone(phoneE164) });
  return { user: user as AppUser, isNew: true };
}

/** Patch arbitrary user fields (onboarding answers, settings). */
export async function updateUser(userId: string, patch: Partial<AppUser>): Promise<void> {
  const { error } = await getSupabaseAdmin().from('users').update(patch).eq('id', userId);
  if (error) throw error;
}

/** Bump last_active_at on each inbound message. */
export async function touchLastActive(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) log.warn('touch_last_active_failed', { user: userId });
}
