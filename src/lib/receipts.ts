// Receipt persistence (TSNAP-022). All access org-scoped via lib/db.orgTable()
// (DEC-001). Amounts stored in cents. photo_url stores the Storage PATH (re-signed
// on read), never a public URL (SEC-001).

import { orgTable } from './db';
import { getSupabaseAdmin } from './supabase';
import type { AppUser } from './users';
import type { ExpenseInput } from './categorize';
import type { SubstantiationRule, SubstantiationResult } from './substantiation';
import type { ReviewAssessment } from './review';
import { todayISO } from './format';

export interface ReceiptRow {
  id: string;
  organization_id: string;
  user_id: string;
  vendor: string | null;
  amount_cents: number;
  transaction_date: string | null;
  payment_account: string | null;
  category: string | null;
  irc_section: string | null;
  deduction_percentage: number | null;
  deductible_amount_cents: number | null;
  business_purpose: string | null;
  attendees: string | null;
  business_relationship: string | null;
  location_city: string | null;
  business_miles: number | null;
  photo_url: string | null;
  needs_receipt: boolean;
  receipt_reason: string | null;
  // Suppression (DEC-078): set when the user says "no receipt available". The reminder cron
  // skips these; needs_receipt stays true so a late photo still attaches and the gap still
  // shows on export. receipt_reminder_count is the per-receipt weekly-nudge counter (auto-cap).
  receipt_waived_at: string | null;
  receipt_reminder_count: number;
  substantiation_complete: boolean;
  substantiation_missing_fields: string[] | null;
  raw_extracted_data: unknown;
  notes: string | null;
  flagged_for_cpa: boolean;
  needs_review: boolean;
  review_reason: string | null;
  category_confidence: number | null;
  created_at: string;
}

/** Insert a categorized expense. Returns the new receipt id. */
export async function saveReceipt(args: {
  user: AppUser;
  input: ExpenseInput;
  category: string;
  rule: SubstantiationRule;
  decision: SubstantiationResult;
  photoPath?: string | null;
  review?: ReviewAssessment;
}): Promise<string> {
  const { user, input, category, rule, decision, photoPath, review } = args;

  const row = {
    user_id: user.id,
    vendor: input.vendor,
    amount_cents: input.amount_cents ?? 0,
    transaction_date: input.transaction_date ?? todayISO(),
    payment_account: user.default_payment_account ?? 'unknown',
    category,
    irc_section: rule.irc_section,
    deduction_percentage: decision.deduction_percentage,
    deductible_amount_cents: decision.deductible_amount_cents,
    business_purpose: input.business_purpose,
    attendees: input.attendees,
    business_relationship: input.business_relationship,
    location_city: input.location_city,
    business_miles: input.business_miles,
    photo_url: photoPath ?? null,
    needs_receipt: decision.needs_receipt,
    receipt_reason: decision.receipt_reason,
    substantiation_complete: decision.substantiation_complete,
    substantiation_missing_fields: decision.missing_context_fields,
    raw_extracted_data: input.raw_text ? { text: input.raw_text } : input,
    needs_review: review?.needsReview ?? false,
    review_reason: review?.reason ?? null,
    category_confidence: review?.confidence ?? null,
  };

  const { data, error } = await orgTable('receipts', user.organization_id).insertOne(row);
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Fetch one receipt (org-scoped). */
export async function getReceipt(orgId: string, receiptId: string): Promise<ReceiptRow | null> {
  const { data, error } = await orgTable('receipts', orgId).select().eq('id', receiptId).maybeSingle();
  if (error) throw error;
  return (data as ReceiptRow | null) ?? null;
}

/** Count an org's receipts created since `sinceIso` — for usage caps (DEC-050, cost control). */
export async function countReceiptsSince(orgId: string, sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Patch a receipt (org-scoped). Returns the updated row (or null if no row matched
 * this org + id), so callers can skip a follow-up getReceipt. The null return also
 * serves as the existence/404 signal on edit paths.
 */
export async function updateReceipt(
  orgId: string,
  receiptId: string,
  patch: Partial<ReceiptRow>,
): Promise<ReceiptRow | null> {
  const { data, error } = await orgTable('receipts', orgId)
    .update(patch)
    .eq('id', receiptId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as ReceiptRow | null) ?? null;
}

/**
 * The org's most recent receipt if it was created since `sinceIso`, else null — for the
 * post-log correction window (DEC-064). A tight window so an old receipt never absorbs an
 * unrelated later message. One-row query (newest first).
 */
export async function getLatestReceiptSince(orgId: string, sinceIso: string): Promise<ReceiptRow | null> {
  const { data, error } = await orgTable('receipts', orgId)
    .select()
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ReceiptRow | null) ?? null;
}

export type ReceiptFilter = 'all' | 'needs_attention' | 'this_month';

/** List receipts for the dashboard (org-scoped, newest first, paginated + filtered). */
export async function listReceipts(
  orgId: string,
  opts: { filter?: ReceiptFilter; limit?: number; offset?: number } = {},
): Promise<{ rows: ReceiptRow[]; hasMore: boolean }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;
  let q = orgTable('receipts', orgId)
    .select()
    .order('created_at', { ascending: false })
    .range(offset, offset + limit); // fetch one extra to detect hasMore

  if (opts.filter === 'needs_attention') {
    q = q.or('needs_receipt.eq.true,substantiation_complete.eq.false');
  } else if (opts.filter === 'this_month') {
    q = q.gte('transaction_date', monthStart());
  }

  const { data, error } = await q;
  if (error) throw error;
  const all = (data as unknown as ReceiptRow[]) ?? [];
  return { rows: all.slice(0, limit), hasMore: all.length > limit };
}

/** All receipts for an org, newest first — for CSV/QBO export (TSNAP-042/043). */
export async function getAllReceiptsForExport(orgId: string): Promise<ReceiptRow[]> {
  const { data, error } = await orgTable('receipts', orgId)
    .select()
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return (data as unknown as ReceiptRow[]) ?? [];
}

/**
 * Tax years (calendar) the org has receipts in, newest first, for the cleanup
 * year switcher (TSNAP-095). Always includes the current year even with no data,
 * so the panel is never empty. Derives the range from the earliest receipt date
 * (one-row query) rather than pulling every row.
 */
export async function getReceiptYears(orgId: string): Promise<number[]> {
  const { data, error } = await orgTable('receipts', orgId)
    .select('transaction_date')
    .order('transaction_date', { ascending: true })
    .limit(1);
  if (error) throw error;

  const current = new Date().getFullYear();
  const rows = (data as unknown as { transaction_date: string | null }[] | null) ?? [];
  const earliest = rows[0]?.transaction_date;
  const startYear = earliest ? new Date(`${earliest}T00:00:00Z`).getUTCFullYear() : current;

  const years: number[] = [];
  for (let y = current; y >= Math.min(startYear, current); y--) years.push(y);
  return years;
}

/**
 * All receipts whose transaction_date falls in the given tax (calendar) year,
 * oldest first — for the year-end cleanup scan (TSNAP-EPIC-9). Org-scoped.
 */
export async function getReceiptsForYear(orgId: string, year: number): Promise<ReceiptRow[]> {
  const { data, error } = await orgTable('receipts', orgId)
    .select()
    .gte('transaction_date', `${year}-01-01`)
    .lte('transaction_date', `${year}-12-31`)
    .order('transaction_date', { ascending: true });
  if (error) throw error;
  return (data as unknown as ReceiptRow[]) ?? [];
}

/**
 * All receipts whose transaction_date falls in the given calendar month ('YYYY-MM'),
 * oldest first — for the month-end review agent (Phase 2, AGENTS-VS-WORKFLOWS.md). Org-scoped.
 */
export async function getReceiptsForMonth(orgId: string, month: string): Promise<ReceiptRow[]> {
  // month is 'YYYY-MM'; lte to the next month's first day catches the whole month regardless of length.
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const { data, error } = await orgTable('receipts', orgId)
    .select()
    .gte('transaction_date', `${month}-01`)
    .lt('transaction_date', nextMonth)
    .order('transaction_date', { ascending: true });
  if (error) throw error;
  return (data as unknown as ReceiptRow[]) ?? [];
}

/**
 * An org's prior receipts for a given vendor (case-insensitive substring), newest first —
 * for the month-end review agent to spot categorization inconsistencies ("logged Delta as
 * travel last month, meals this month"). Org-scoped.
 */
export async function getReceiptsByVendor(orgId: string, vendor: string, limit = 10): Promise<ReceiptRow[]> {
  const term = vendor.trim();
  if (!term) return [];
  const { data, error } = await orgTable('receipts', orgId)
    .select()
    .ilike('vendor', `%${term}%`)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as ReceiptRow[]) ?? [];
}

export interface MonthlySummary {
  total_cents: number;
  count: number;
  deductible_cents: number;
  complete_count: number;
  needs_attention_count: number;
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/** Aggregate this-month stats for the dashboard summary widget (TSNAP-038). */
export async function getMonthlySummary(orgId: string): Promise<MonthlySummary> {
  const { data, error } = await orgTable('receipts', orgId)
    .select('amount_cents, deductible_amount_cents, substantiation_complete, needs_receipt, substantiation_missing_fields')
    .gte('transaction_date', monthStart());
  if (error) throw error;
  const rows = (data as unknown as Pick<ReceiptRow, 'amount_cents' | 'deductible_amount_cents' | 'substantiation_complete' | 'needs_receipt' | 'substantiation_missing_fields'>[]) ?? [];

  let total = 0, deductible = 0, complete = 0, attention = 0;
  for (const r of rows) {
    total += r.amount_cents ?? 0;
    deductible += r.deductible_amount_cents ?? 0;
    if (r.substantiation_complete) complete++;
    else attention++;
  }
  return {
    total_cents: total,
    count: rows.length,
    deductible_cents: deductible,
    complete_count: complete,
    needs_attention_count: attention,
  };
}

/**
 * Recent receipts still awaiting a receipt photo (needs_receipt=TRUE), newest first.
 * Used by the attachment flow to match an incoming photo (TSNAP-024).
 */
export async function findReceiptsAwaitingPhoto(orgId: string, limit = 5): Promise<ReceiptRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('receipts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('needs_receipt', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ReceiptRow[]) ?? [];
}

/**
 * Mark a receipt "no receipt available" (DEC-078) — stops the weekly reminder cron from nudging
 * it. Deliberately does NOT clear needs_receipt (a late photo still attaches via the attachment
 * flow) and does NOT set substantiation_complete (a waived ≥$75 strict expense is still an audit
 * gap; it stays visible in the dashboard cleanup list and on the export). Idempotent: re-waiving
 * keeps the original timestamp via COALESCE-like guard at the call site is unnecessary — the
 * cron only cares that it's non-null.
 */
export async function waiveReceipt(orgId: string, receiptId: string): Promise<ReceiptRow | null> {
  return updateReceipt(orgId, receiptId, { receipt_waived_at: new Date().toISOString() });
}

/**
 * Waive ALL of an org's outstanding flagged-not-waived receipts at once (DEC-078). Used when a user
 * replies "no receipt" to the WEEKLY reminder, which is about every flagged receipt — not a single
 * live one (the cron sets no per-receipt pending context). Same semantics as waiveReceipt: sets
 * receipt_waived_at, leaves needs_receipt set (a late photo still attaches) and never marks
 * substantiation_complete (the gap stays visible + on the export). Returns how many were waived.
 */
export async function waiveAllFlaggedReceipts(orgId: string): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from('receipts')
    .update({ receipt_waived_at: new Date().toISOString() })
    .eq('organization_id', orgId)
    .eq('needs_receipt', true)
    .is('receipt_waived_at', null)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

/** How many of an org's receipts are still flagged for a receipt and not waived (for deciding
 *  whether a "later"-style reply to the reminder should be acknowledged vs. ignored). */
export async function countFlaggedReceipts(orgId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('needs_receipt', true)
    .is('receipt_waived_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** A flagged receipt the weekly reminder cron may nudge about (DEC-078). */
export interface ReminderCandidate {
  id: string;
  user_id: string;
  amount_cents: number;
  receipt_reminder_count: number;
}

/**
 * Receipts due for a weekly receipt-reminder nudge (DEC-078): still flagged, NOT waived, under
 * the per-receipt reminder cap, and at least `minAgeHours` old (don't nag same-day). System-wide
 * (the cron isn't org-scoped). Returns the per-receipt counter so the caller can cap + increment.
 */
export async function listReceiptsNeedingReminder(cap: number, minAgeHours = 24): Promise<ReminderCandidate[]> {
  const cutoff = new Date(Date.now() - minAgeHours * 3600 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('receipts')
    .select('id, user_id, amount_cents, receipt_reminder_count')
    .eq('needs_receipt', true)
    .is('receipt_waived_at', null)
    .lt('receipt_reminder_count', cap)
    .lte('created_at', cutoff);
  if (error) throw error;
  return (data as ReminderCandidate[]) ?? [];
}

/** Increment the weekly-nudge counter for the given receipts after a successful send (DEC-078). */
export async function bumpReceiptReminderCounts(rows: ReminderCandidate[]): Promise<void> {
  const admin = getSupabaseAdmin();
  await Promise.all(
    rows.map((r) =>
      admin.from('receipts').update({ receipt_reminder_count: r.receipt_reminder_count + 1 }).eq('id', r.id),
    ),
  );
}
