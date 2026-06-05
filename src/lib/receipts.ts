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
