// Org-scoped data access (DEC-001).
//
// EVERY server query against an org-owned table must go through orgTable(), which
// injects `organization_id` on reads, writes, updates, and deletes. This is the
// app-layer half of our multi-tenant isolation; the DB-layer half is RLS
// default-deny (see supabase/migrations/0001_schema.sql).
//
// Tables WITHOUT organization_id (auth_codes, sessions, substantiation_rules,
// irc_summaries) are accessed directly via getSupabaseAdmin() — they are either
// global config or keyed by phone/token, not by org.

import { getSupabaseAdmin } from './supabase';

/** Org-owned tables that carry an organization_id column. */
export type OrgTable = 'users' | 'receipts' | 'conversations' | 'user_roles';

type Row = Record<string, unknown>;

/**
 * Returns query builders pre-scoped to a single organization. Prefer these over
 * touching getSupabaseAdmin().from(table) directly for org-owned tables.
 */
export function orgTable(table: OrgTable, organizationId: string) {
  const admin = getSupabaseAdmin();
  return {
    /** SELECT * scoped to this org. Chain .eq/.order/.range as needed. */
    select: (columns = '*') =>
      admin.from(table).select(columns).eq('organization_id', organizationId),

    /** INSERT a single row with organization_id injected; returns the row. */
    insertOne: (row: Row) =>
      admin
        .from(table)
        .insert({ ...row, organization_id: organizationId })
        .select()
        .single(),

    /** UPDATE scoped to this org. Chain a further .eq('id', ...) before await. */
    update: (patch: Row) =>
      admin.from(table).update(patch).eq('organization_id', organizationId),

    /** DELETE scoped to this org. Chain a further .eq('id', ...) before await. */
    delete: () => admin.from(table).delete().eq('organization_id', organizationId),
  };
}
