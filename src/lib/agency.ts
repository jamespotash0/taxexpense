// Agency tier (Spec 10): one agency manages many SEPARATE creator orgs (one manager → many books),
// distinct from co-owners (many people → one shared book, DEC-045). This module holds the foundation
// + provisioning (Fix 1). The cross-org access guard (Fix 2), the entitlement fork (Fix 3), and the
// agency dashboard land in the next chunk — and the authz guard is the security-critical piece.
//
// All access via the service-role admin client (agencies/orgs aren't org-scoped at creation), same
// posture as users.ts. OWNER: raj (schema) + jordan (the authz boundary, next chunk).

import { getSupabaseAdmin } from './supabase';
import { log, maskPhone } from './log';
import { getUserByPhone, type AppUser } from './users';
import { getMonthlySummary, type MonthlySummary } from './receipts';

export interface Agency {
  id: string;
  name: string | null;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  seat_plan: string | null;
}

export type AgencyRole = 'admin' | 'staff';

/** Create an agency (the managing tenant). Billing is set by hand for the first agencies (Fix 3). */
export async function createAgency(name: string | null): Promise<string> {
  const { data, error } = await getSupabaseAdmin().from('agencies').insert({ name }).select('id').single();
  if (error) throw error;
  log.info('agency_created', { agency: data.id });
  return data.id as string;
}

/** Add a staff/admin user to an agency. Idempotent on (agency_id, user_id). */
export async function addAgencyMember(agencyId: string, userId: string, role: AgencyRole = 'staff'): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('agency_members')
    .upsert({ agency_id: agencyId, user_id: userId, role }, { onConflict: 'agency_id,user_id' });
  if (error) throw error;
}

export type ProvisionResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; reason: 'phone_in_use' };

/**
 * Provision a NEW managed creator org under an agency (Spec 10, Fix 1). Sibling to inviteToOrg, but
 * inviteToOrg attaches a co-owner to an EXISTING org (many people → one shared book); this creates a
 * SEPARATE org the agency manages (one manager → many books), so each creator stays their own
 * taxpayer with their own Schedule C.
 *
 * The creator owns the org and still texts from their own phone; their first inbound is the TCPA
 * opt-in (sms_consent_at left null, stamped by getOrCreateUserByPhone, which finds this pre-seeded
 * row instead of spinning up a fresh standalone org).
 *
 * Net-new phones only: a number already attached to ANY org is refused — re-homing an existing
 * account is an account-merge, out of scope (same constraint as inviteToOrg).
 */
export async function provisionCreatorOrg(
  agencyId: string,
  phoneE164: string,
  fullName: string | null,
): Promise<ProvisionResult> {
  if (await getUserByPhone(phoneE164)) return { ok: false, reason: 'phone_in_use' };

  const admin = getSupabaseAdmin();

  // Managed org: born with agency_id set and NO trial/subscription of its own — entitlement flows
  // from the agency (getOrgEntitlement forks on agency_id, Spec 10 Fix 3). Deliberately leaving
  // subscription_status null also keeps the creator out of the trial-ended reminder cron
  // (listTrialingForReminder only scans status='trialing'), so the agency's creators are never
  // texted a spurious "your trial ended, subscribe" notice.
  const { data: org, error: orgErr } = await admin
    .from('organizations')
    .insert({ agency_id: agencyId, subscription_tier: 'free' })
    .select('id')
    .single();
  if (orgErr) throw orgErr;

  const { data: user, error: userErr } = await admin
    .from('users')
    .insert({
      organization_id: org.id,
      phone_number: phoneE164,
      full_name: fullName,
      onboarding_completed: false,
      onboarding_step: 0,
      // sms_consent_at intentionally omitted — first inbound is the TCPA opt-in.
    })
    .select('id')
    .single();
  if (userErr) throw userErr;

  // Backfill org owner + an owner role (mirrors getOrCreateUserByPhone).
  await admin.from('organizations').update({ owner_user_id: user.id }).eq('id', org.id);
  await admin.from('user_roles').insert({ user_id: user.id, organization_id: org.id, role: 'owner' });

  log.info('creator_provisioned', { agency: agencyId, org: org.id, phone: maskPhone(phoneE164) });
  return { ok: true, organizationId: org.id, userId: user.id };
}

// ── Cross-org access guard (Spec 10, Fix 2) ──────────────────────────────────────────────
// SECURITY-CRITICAL: this is the multi-tenant boundary. A bug here is a breach (Agency A seeing
// Agency B's creators, or a creator seeing a sibling). The DECISION is isolated into the pure
// canAccessOrg() so its negative cases are exhaustively unit-tested; the I/O wrappers only feed it.

export interface OrgAccessContext {
  /** The requester's own organization_id (always accessible to them). */
  userOrgId: string;
  /** Agency ids the requester is a STAFF/ADMIN member of. Empty for creators and direct users. */
  userAgencyIds: readonly string[];
  /** The org being accessed. */
  targetOrgId: string;
  /** The target org's agency_id (null = self-serve / unmanaged). */
  targetOrgAgencyId: string | null;
}

/**
 * PURE authorization decision — the single source of truth for cross-org access. Access iff the
 * target is the requester's own org, OR the target is managed by an agency the requester is a
 * member of. Crucially, being a CREATOR under an agency does NOT grant access to sibling creators:
 * only agency_members (staff) get cross-org access, and only their membership populates
 * userAgencyIds — a creator's userAgencyIds is empty, so they reach only their own org.
 */
export function canAccessOrg(ctx: OrgAccessContext): boolean {
  if (ctx.targetOrgId === ctx.userOrgId) return true;
  if (ctx.targetOrgAgencyId !== null && ctx.userAgencyIds.includes(ctx.targetOrgAgencyId)) return true;
  return false;
}

/** Agency ids this user is a staff/admin member of (their cross-org access rights). Empty for
 *  creators and direct self-serve users. */
export async function getUserAgencyIds(userId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().from('agency_members').select('agency_id').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.agency_id as string);
}

/** The org's managing agency id, or null if self-serve. */
export async function getOrgAgencyId(orgId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().from('organizations').select('agency_id').eq('id', orgId).maybeSingle();
  if (error) throw error;
  return (data?.agency_id as string | null) ?? null;
}

/** Every org id the user may access: their own + all creator orgs under agencies they're a member
 *  of. Backs the agency dashboard's client list (Fix 4). */
export async function getAccessibleOrgs(user: AppUser): Promise<string[]> {
  const agencyIds = await getUserAgencyIds(user.id);
  const ids = new Set<string>([user.organization_id]);
  if (agencyIds.length) {
    const { data, error } = await getSupabaseAdmin().from('organizations').select('id').in('agency_id', agencyIds);
    if (error) throw error;
    for (const r of data ?? []) ids.add(r.id as string);
  }
  return [...ids];
}

/**
 * THE enforcement point — authorize a request to act on `orgId`. Call at the top of every cross-org
 * route/server action before scoping any query to that org (Spec 10, Fix 2). Fast path for the
 * user's own org (no DB); otherwise resolves the user's agency memberships + the target's agency and
 * applies canAccessOrg.
 */
export async function assertCanAccessOrg(user: AppUser, orgId: string): Promise<boolean> {
  if (orgId === user.organization_id) return true;
  const [userAgencyIds, targetOrgAgencyId] = await Promise.all([getUserAgencyIds(user.id), getOrgAgencyId(orgId)]);
  return canAccessOrg({ userOrgId: user.organization_id, userAgencyIds, targetOrgId: orgId, targetOrgAgencyId });
}

// ── Agency dashboard data (Spec 10, Fix 4) ───────────────────────────────────────────────

export interface AgencyCreator {
  orgId: string;
  /** Display name: the creator's full_name, else their phone, else a placeholder. */
  name: string;
  phone: string | null;
  summary: MonthlySummary;
}

/**
 * The managed creators visible to an agency staffer, each with this-month stats, sorted by who needs
 * the most attention first — the "who's missing what" board that turns the March chase into a
 * glance. Returns [] for a non-staff user (no agency memberships). One summary query per creator;
 * fine for the demo-scale cohorts this serves.
 */
export async function listAgencyCreators(user: AppUser): Promise<AgencyCreator[]> {
  const agencyIds = await getUserAgencyIds(user.id);
  if (!agencyIds.length) return [];

  const admin = getSupabaseAdmin();
  const { data: orgs, error: orgErr } = await admin.from('organizations').select('id').in('agency_id', agencyIds);
  if (orgErr) throw orgErr;
  const orgIds = (orgs ?? []).map((o) => o.id as string);
  if (!orgIds.length) return [];

  // One query for the creator (owner) of each managed org → display name + phone.
  const { data: members, error: memErr } = await admin
    .from('users')
    .select('organization_id, full_name, phone_number')
    .in('organization_id', orgIds);
  if (memErr) throw memErr;
  const info = new Map<string, { name: string | null; phone: string | null }>();
  for (const m of members ?? []) {
    const oid = m.organization_id as string;
    if (!info.has(oid)) info.set(oid, { name: (m.full_name as string | null) ?? null, phone: (m.phone_number as string | null) ?? null });
  }

  const summaries = await Promise.all(orgIds.map((id) => getMonthlySummary(id)));
  const creators: AgencyCreator[] = orgIds.map((orgId, i) => {
    const meta = info.get(orgId) ?? { name: null, phone: null };
    return { orgId, name: meta.name || meta.phone || 'Creator', phone: meta.phone, summary: summaries[i] };
  });
  creators.sort((a, b) => b.summary.needs_attention_count - a.summary.needs_attention_count);
  return creators;
}
