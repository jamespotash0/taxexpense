// Receipt persistence (TSNAP-022). All access org-scoped via lib/db.orgTable()
// (DEC-001). Amounts stored in cents. photo_url stores the Storage PATH (re-signed
// on read), never a public URL (SEC-001).

import { orgTable } from './db';
import { getSupabaseAdmin } from './supabase';
import type { AppUser } from './users';
import type { ExpenseInput } from './categorize';
import type { SubstantiationRule, SubstantiationResult } from './substantiation';

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
  created_at: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Insert a categorized expense. Returns the new receipt id. */
export async function saveReceipt(args: {
  user: AppUser;
  input: ExpenseInput;
  category: string;
  rule: SubstantiationRule;
  decision: SubstantiationResult;
  photoPath?: string | null;
}): Promise<string> {
  const { user, input, category, rule, decision, photoPath } = args;

  const row = {
    user_id: user.id,
    vendor: input.vendor,
    amount_cents: input.amount_cents ?? 0,
    transaction_date: input.transaction_date ?? today(),
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

/** Patch a receipt (org-scoped). */
export async function updateReceipt(
  orgId: string,
  receiptId: string,
  patch: Partial<ReceiptRow>,
): Promise<void> {
  const { error } = await orgTable('receipts', orgId).update(patch).eq('id', receiptId);
  if (error) throw error;
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
