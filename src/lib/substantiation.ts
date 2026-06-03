// Substantiation decision tree — the heart of the product.
// OWNER: Priya + Raj. EPIC-3 logic, used by EPIC-2 categorization.
//
// DEC-011: this is the AUTHORITATIVE, deterministic implementation of the decision
// tree in claude_files/docs/SPEC.md. The LLM never computes these flags. Pure
// function (evaluateSubstantiation) so it is fully unit-testable; the DB loader is
// the only side-effecting part.

import { getSupabaseAdmin } from './supabase';

// IRS standard business mileage rate, in cents per mile. 2026 = 72.5¢ (up 2.5¢ from 70¢ in
// 2025) — verified against IRS Notice 2026-10 (irs.gov, DEC-034). Single source of truth for
// vehicle_business dollar derivation; bump yearly against the new IRS Notice each January.
export const MILEAGE_RATE_CENTS_PER_MILE = 72.5;

export interface SubstantiationRule {
  category: string;
  irc_section: string | null;
  substantiation_level: 'strict' | 'general';
  receipt_threshold_cents: number | null;
  always_receipt: boolean;
  required_context_fields: string[];
  deduction_percentage: number;
  deduction_cap_cents: number | null;
}

export interface SubstantiationInput {
  amount_cents: number;
  has_photo: boolean;
  /** Map of field name -> captured value (e.g. { business_purpose: "Q3", attendees: null }). */
  captured_fields: Record<string, unknown>;
}

export interface SubstantiationResult {
  needs_receipt: boolean;
  receipt_reason: string | null;
  missing_context_fields: string[];
  substantiation_complete: boolean;
  deduction_percentage: number;
  deductible_amount_cents: number;
}

/** A required context field counts as captured if it has a non-empty value. */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  return true;
}

/**
 * Deductible = amount × deduction% , then capped at deduction_cap_cents if set.
 * (Gift cap is per-recipient/year per IRS; V1 applies it per-receipt — see DEC-011 notes.)
 */
export function computeDeductibleCents(rule: SubstantiationRule, amountCents: number): number {
  const raw = Math.round((amountCents * rule.deduction_percentage) / 100);
  if (rule.deduction_cap_cents != null) return Math.min(raw, rule.deduction_cap_cents);
  return raw;
}

/**
 * Run the substantiation decision tree. Pure — no I/O.
 * See SPEC.md "The Substantiation Decision Tree".
 */
export function evaluateSubstantiation(
  rule: SubstantiationRule,
  input: SubstantiationInput,
): SubstantiationResult {
  const deduction_percentage = rule.deduction_percentage;
  const deductible_amount_cents = computeDeductibleCents(rule, input.amount_cents);

  // General substantiation: log it, no receipt, no required context. Done.
  if (rule.substantiation_level === 'general') {
    return {
      needs_receipt: false,
      receipt_reason: null,
      missing_context_fields: [],
      substantiation_complete: true,
      deduction_percentage,
      deductible_amount_cents,
    };
  }

  // Strict substantiation (IRC §274(d)).
  let needs_receipt = false;
  let receipt_reason: string | null = null;

  if (rule.always_receipt) {
    // Lodging, gifts — receipt required at any amount.
    if (!input.has_photo) {
      needs_receipt = true;
      receipt_reason = 'This category always requires a receipt per IRS rules (any amount).';
    }
  } else if (rule.receipt_threshold_cents != null) {
    // $75 rule: at/over threshold needs a third-party receipt.
    if (input.amount_cents >= rule.receipt_threshold_cents && !input.has_photo) {
      needs_receipt = true;
      const dollars = Math.round(rule.receipt_threshold_cents / 100);
      receipt_reason = `Over $${dollars} so the IRS asks for a receipt photo for this one.`;
    }
  }
  // (threshold == null, e.g. vehicle_business → mileage never needs a receipt)

  const missing_context_fields = rule.required_context_fields.filter(
    (field) => !isPresent(input.captured_fields[field]),
  );

  const substantiation_complete = missing_context_fields.length === 0 && !needs_receipt;

  return {
    needs_receipt,
    receipt_reason,
    missing_context_fields,
    substantiation_complete,
    deduction_percentage,
    deductible_amount_cents,
  };
}

/** Load a single substantiation rule by category (global config table; not org-scoped). */
export async function getSubstantiationRule(category: string): Promise<SubstantiationRule | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('substantiation_rules')
    .select(
      'category, irc_section, substantiation_level, receipt_threshold_cents, always_receipt, required_context_fields, deduction_percentage, deduction_cap_cents',
    )
    .eq('category', category)
    .maybeSingle();

  if (error) throw error;
  return (data as SubstantiationRule | null) ?? null;
}
