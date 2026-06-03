// Recurring expenses (DEC-033). "Detect a repeat → offer → remind & confirm." A template
// here NEVER auto-creates a receipt; it only drives a monthly "did it renew? reply Y" nudge,
// and the normal capture flow logs the occurrence after the user confirms. This avoids
// fabricating tax records for a subscription that was canceled or changed price.

import { getSupabaseAdmin } from './supabase';
import { formatMoney } from './format';
import type { ReceiptRow } from './receipts';
import type { ExpenseInput } from './categorize';

export interface RecurringRow {
  id: string;
  organization_id: string;
  user_id: string;
  vendor: string | null;
  amount_cents: number;
  category: string | null;
  business_purpose: string | null;
  cadence: 'monthly';
  next_due: string;
  status: 'active' | 'awaiting_confirm' | 'paused';
  last_logged_at: string | null;
  confirm_sent_at: string | null;
}

// How long a "did it renew?" nudge stays answerable, and how long before the cron
// auto-skips an unanswered one so a template can't get stuck awaiting_confirm forever.
export const CONFIRM_WINDOW_HOURS = 72;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/** Add one calendar month to a YYYY-MM-DD date, clamping the day to the target month. */
export function addOneMonth(date: string): string {
  const [y, m, d] = date.split('-').map(Number); // m is 1-based
  let ny = y;
  let nm = m + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const lastDay = new Date(ny, nm, 0).getDate(); // last day of 1-based month nm
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

const AFFIRM_RE = /^\s*(?:(?:y|ye|yes|yep|yup|yeah|ya|sure|ok|okay|confirm|confirmed|log it|do it)\b|👍|✅)/i;
const NEGATE_RE = /^\s*(n|no|nope|nah|skip|didn'?t|did not|not this|cancel)\b/i;

/** True when a reply clearly means "yes, log it". */
export function isAffirmative(text: string): boolean {
  return AFFIRM_RE.test(text.trim());
}
/** True when a reply clearly means "no / skip". */
export function isNegative(text: string): boolean {
  return NEGATE_RE.test(text.trim());
}

function label(vendor: string | null, amountCents: number): string {
  return `${vendor ?? 'that expense'} ${formatMoney(amountCents)}`;
}

// Categories that are subscription/bill-shaped — a fixed charge that recurs monthly. The AI
// categorization tells us this, so we can offer to track on the FIRST log (no repeat needed)
// rather than waiting for the user to re-text the same amount. Variable categories (meals,
// travel, rides…) are excluded — only a detected repeat offers recurring for those.
const RECURRING_LIKELY = new Set(['software', 'internet_phone', 'insurance', 'rent']);

/** True when the AI category implies a recurring subscription/bill (offer proactively). */
export function isRecurringLikely(category: string | null): boolean {
  return category != null && RECURRING_LIKELY.has(category);
}

/** Why we're offering — drives the copy. 'subscription' = category-based (often first time). */
export type OfferReason = 'subscription' | 'repeat';

/** Offer to start tracking, appended after a normal "logged" reply. */
export function offerRecurring(vendor: string | null, amountCents: number, reason: OfferReason): string {
  if (reason === 'subscription') {
    return `${vendor ?? 'That'} ${formatMoney(amountCents)} looks like a recurring subscription — want me to track it monthly so you don't have to re-text it? Reply YES.`;
  }
  return `I've logged ${label(vendor, amountCents)} before — want me to track it monthly so you don't have to re-text it? Reply YES.`;
}

/** Confirmation that a template is now tracked. */
export function recurringCreatedMsg(vendor: string | null, amountCents: number): string {
  return `✓ Tracking ${label(vendor, amountCents)} monthly. I'll check in before each one — nothing is logged until you confirm.`;
}

/** The monthly nudge (cron-initiated). */
export function confirmRenewalMsg(vendor: string | null, amountCents: number): string {
  return `Heads up — your ${label(vendor, amountCents)} usually recurs around now. Did it? Reply Y to log it, or N to skip.`;
}

/** Reply after the user skips a renewal. */
export function skippedRenewalMsg(vendor: string | null): string {
  return `No problem — skipped ${vendor ?? 'it'} this month. I'll check again next time.`;
}

/** Build the expense input to re-log when a renewal is confirmed. */
export function templateToExpenseInput(row: RecurringRow): ExpenseInput {
  return {
    amount_cents: row.amount_cents,
    vendor: row.vendor,
    transaction_date: null, // defaults to today in saveReceipt
    attendees: null,
    business_purpose: row.business_purpose,
    business_relationship: null,
    location_city: null,
    business_miles: null,
    has_photo: false,
    raw_text: row.business_purpose,
    items: [],
  };
}

// ---------------------------------------------------------------------------
// Detection (DB, org-scoped)
// ---------------------------------------------------------------------------

/** Count prior receipts with the same vendor (case-insensitive) + amount, excluding one id. */
export async function priorOccurrenceCount(
  orgId: string,
  vendor: string,
  amountCents: number,
  excludeReceiptId: string,
): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .ilike('vendor', vendor)
    .eq('amount_cents', amountCents)
    .neq('id', excludeReceiptId);
  if (error) throw error;
  return count ?? 0;
}

/** Is there already a (non-paused) recurring template for this vendor+amount? */
export async function hasRecurring(orgId: string, vendor: string, amountCents: number): Promise<boolean> {
  const { count, error } = await getSupabaseAdmin()
    .from('recurring_expenses')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .ilike('vendor', vendor)
    .eq('amount_cents', amountCents)
    .neq('status', 'paused');
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Template lifecycle (DB)
// ---------------------------------------------------------------------------

/** Create a monthly template from a just-logged receipt; first nudge one month out. */
export async function createRecurringFromReceipt(receipt: ReceiptRow, today: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from('recurring_expenses').insert({
    organization_id: receipt.organization_id,
    user_id: receipt.user_id,
    vendor: receipt.vendor,
    amount_cents: receipt.amount_cents,
    category: receipt.category,
    business_purpose: receipt.business_purpose,
    cadence: 'monthly',
    next_due: addOneMonth(today),
    status: 'active',
    last_logged_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Active templates due on/before `today` — for the reminder cron. */
export async function getDueRecurring(today: string): Promise<RecurringRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('recurring_expenses')
    .select('*')
    .eq('status', 'active')
    .lte('next_due', today);
  if (error) throw error;
  return (data as RecurringRow[]) ?? [];
}

/** Mark a template as awaiting the user's renew/skip answer + stamp when we asked. */
export async function markAwaitingConfirm(id: string, nowIso: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('recurring_expenses')
    .update({ status: 'awaiting_confirm', confirm_sent_at: nowIso })
    .eq('id', id);
  if (error) throw error;
}

/** The user's most-recent template awaiting a renew/skip answer, within the window. */
export async function getAwaitingConfirm(userId: string): Promise<RecurringRow | null> {
  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('recurring_expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'awaiting_confirm')
    .gte('confirm_sent_at', cutoff)
    .order('confirm_sent_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data as RecurringRow[])?.[0] ?? null;
}

/** Awaiting-confirm templates whose nudge has gone stale — cron auto-skips these. */
export async function getStaleAwaitingConfirm(): Promise<RecurringRow[]> {
  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from('recurring_expenses')
    .select('*')
    .eq('status', 'awaiting_confirm')
    .lt('confirm_sent_at', cutoff);
  if (error) throw error;
  return (data as RecurringRow[]) ?? [];
}

/** Roll a template forward to its next month and back to active (after log or skip). */
export async function advanceRecurring(id: string, fromDate: string, logged: boolean): Promise<void> {
  const patch: Record<string, unknown> = {
    status: 'active',
    next_due: addOneMonth(fromDate),
    confirm_sent_at: null,
  };
  if (logged) patch.last_logged_at = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from('recurring_expenses').update(patch).eq('id', id);
  if (error) throw error;
}
