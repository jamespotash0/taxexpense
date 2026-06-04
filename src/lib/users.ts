// User + organization lookup/creation (TSNAP-016).
// V1 is 1:1 user:org. Users are created on first inbound SMS (SMS-first, DEC-006).
// All access via service-role admin client (users/orgs are not orgTable-scoped on
// creation since we don't yet know the org).

import { getSupabaseAdmin } from './supabase';
import { log } from './log';
import { maskPhone } from './log';
import { MAX_CO_OWNERS } from './pricing';

export interface AppUser {
  id: string;
  organization_id: string;
  phone_number: string;
  full_name: string | null;
  email: string | null; // collected at the dashboard, not over SMS (DEC-014)
  business_type: string | null;
  entity_type: 'sole_prop' | 'smllc' | 's_corp' | 'c_corp' | 'unknown' | null;
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
  if (existing) {
    // An invited co-owner row (inviteToOrg) carries no SMS consent yet — they were added by the
    // org owner but haven't texted. Their first inbound IS the TCPA opt-in, so stamp it now if
    // it's missing.
    if (!existing.sms_consent_at) {
      const sms_consent_at = new Date().toISOString();
      await updateUser(existing.id, { sms_consent_at });
      return { user: { ...existing, sms_consent_at }, isNew: false };
    }
    return { user: existing, isNew: false };
  }

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

// ── Co-owner / multi-user (DEC-045) ────────────────────────────────────────────────
// V1 supports inviting a co-owner (e.g. a spouse) to ONE org so both capture into the
// same books on the org's single subscription. Team/seat billing is deferred (V2).

export interface OrgMember {
  id: string;
  phone_number: string;
  full_name: string | null;
  role: 'owner' | 'editor';
  status: 'active' | 'pending'; // pending = invited but hasn't texted in yet (no SMS consent)
}

/** The org's owner user id (the one billing/invite authority). */
export async function getOrgOwnerId(orgId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('organizations')
    .select('owner_user_id')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  return (data?.owner_user_id as string | undefined) ?? null;
}

/** The org owner's id + display name (for a join-aware greeting to invited co-owners). */
export async function getOrgOwner(orgId: string): Promise<{ id: string; full_name: string | null } | null> {
  const ownerId = await getOrgOwnerId(orgId);
  if (!ownerId) return null;
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('full_name')
    .eq('id', ownerId)
    .maybeSingle();
  if (error) throw error;
  return { id: ownerId, full_name: (data?.full_name as string | null) ?? null };
}

/** Everyone who belongs to an org (owner + invited co-owners), for the settings screen. */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const ownerId = await getOrgOwnerId(orgId);
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, phone_number, full_name, sms_consent_at, onboarding_completed')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id as string,
    phone_number: u.phone_number as string,
    full_name: (u.full_name as string | null) ?? null,
    role: u.id === ownerId ? 'owner' : 'editor',
    status: u.sms_consent_at || u.onboarding_completed ? 'active' : 'pending',
  }));
}

export type InviteResult = { ok: true } | { ok: false; reason: 'already_member' | 'has_other_account' | 'seat_limit' };

/**
 * Invite a co-owner to an EXISTING org by phone (DEC-045). Unlike getOrCreateUserByPhone
 * (which spins up a fresh org), this attaches the new user to the inviter's org and copies the
 * org's business context so the joiner only has to give their NAME on first text —
 * categorization then uses the same entity/payment defaults.
 *
 * Net-new phones only: because phone_number is globally unique, a number that already belongs
 * to ANY org is refused. Re-homing an existing account (with its receipts/subscription) is an
 * account-merge — explicitly out of scope for V1.
 *
 * TCPA: sms_consent_at is left null; the joiner's first inbound text is their opt-in (stamped
 * by getOrCreateUserByPhone, which finds this pre-seeded row instead of creating a new org).
 */
export async function inviteToOrg(
  orgId: string,
  phoneE164: string,
  inviterProfile: Pick<AppUser, 'business_type' | 'entity_type' | 'default_payment_account'>,
): Promise<InviteResult> {
  const existing = await getUserByPhone(phoneE164);
  if (existing) {
    return existing.organization_id === orgId
      ? { ok: false, reason: 'already_member' }
      : { ok: false, reason: 'has_other_account' };
  }

  const admin = getSupabaseAdmin();

  // Seat cap (DEC-047): owner + MAX_CO_OWNERS. Co-owners are included on the one subscription,
  // so cap headcount to keep a team from riding a single plan; per-seat billing is V2.
  const { count, error: countErr } = await admin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (countErr) throw countErr;
  if ((count ?? 0) >= 1 + MAX_CO_OWNERS) return { ok: false, reason: 'seat_limit' };

  const { data: user, error } = await admin
    .from('users')
    .insert({
      organization_id: orgId,
      phone_number: phoneE164,
      business_type: inviterProfile.business_type,
      entity_type: inviterProfile.entity_type,
      default_payment_account: inviterProfile.default_payment_account,
      onboarding_completed: false,
      onboarding_step: 0,
      // sms_consent_at intentionally omitted — first inbound is the TCPA opt-in.
    })
    .select('id')
    .single();
  if (error) throw error;

  await admin.from('user_roles').insert({ user_id: user.id, organization_id: orgId, role: 'editor' });
  log.info('user_invited', { org: orgId, phone: maskPhone(phoneE164) });
  return { ok: true };
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
