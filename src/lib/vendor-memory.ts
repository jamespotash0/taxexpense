// Per-org vendor→category memory (DEC-070). Deterministic personalization, NOT machine learning:
// a per-tenant lookup table that learns from explicit user category CORRECTIONS and applies them
// to future captures, so a user never has to correct the same vendor twice.
//
// Design (kept deliberately boring — Raj/Alex):
//   • LEARN only from explicit user category choices (an SMS correction, a dashboard category edit)
//     — never from the model's own guess, which would just reinforce its mistakes.
//   • APPLY by overriding the model's category when a learned mapping exists and differs. The
//     mapping only ever came from the user, so trusting it over a fresh guess is correct by
//     construction; the user can always re-correct, which re-teaches it (latest correction wins).
//   • Strictly per-org: every query is scoped by organization_id (multi-tenant isolation, Jordan).
//   • Never breaks capture: all DB work is wrapped — a memory failure degrades to the model's pick,
//     it never throws into the expense flow.
//
// Known V1 limitation: one preferred category per vendor per org. A vendor that legitimately spans
// categories (e.g. Amazon → office_supplies vs equipment) will be overridden to the last-corrected
// one; the user re-corrects and it updates. Context/amount-aware memory is a deferred V2 idea.

import { getSupabaseAdmin } from './supabase';
import { isValidCategory } from './categories';
import { log } from './log';
import type { CategoryResult } from './categorize';

const TABLE = 'vendor_category_memory';

/**
 * Normalize a raw vendor string into a stable match key (pure): lowercased, possessives and
 * punctuation stripped, whitespace collapsed. Returns null when nothing usable remains (so we
 * never key memory on an empty/one-char vendor). "Morton's Steakhouse" and "mortons steakhouse"
 * both → "mortons steakhouse".
 */
export function vendorKey(vendor: string | null | undefined): string | null {
  if (!vendor) return null;
  const key = vendor
    .toLowerCase()
    .replace(/['’]/g, '') // drop apostrophes so "Morton's" and "mortons" collapse to one key
    .replace(/[^a-z0-9]+/g, ' ') // any other punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
  return key.length >= 2 ? key : null;
}

/** Categories we don't learn: the drift catch-all isn't a deliberate user choice. */
function isLearnable(category: string): boolean {
  return isValidCategory(category) && category !== 'other_business';
}

/**
 * Pure: fold a learned mapping into the model's result. If the learned category equals the model's
 * pick (or isn't usable) the model result is returned unchanged; otherwise the learned category
 * wins, with a high confidence and a reasoning note so the override is visible + overridable.
 */
export function applyMemoryToResult(
  memoryCategory: string | null,
  result: CategoryResult,
  vendorLabel: string | null,
): CategoryResult {
  if (!memoryCategory || !isValidCategory(memoryCategory) || memoryCategory === result.category) {
    return result;
  }
  const who = vendorLabel ? ` for ${vendorLabel}` : '';
  return {
    category: memoryCategory,
    confidence: Math.max(result.confidence, 0.95),
    reasoning: `Matches your previous correction${who} → ${memoryCategory} (model suggested ${result.category}).`,
    drifted: false,
    fromMemory: true,
  };
}

/**
 * Learn (or reinforce) a vendor→category mapping from an EXPLICIT user correction. Idempotent and
 * non-throwing — a failure here must never break the user's correction flow. Latest correction
 * wins: if the category flips, we adopt the new one and reset the confirmation count.
 */
export async function rememberVendorCategory(orgId: string, vendor: string | null, category: string): Promise<void> {
  const key = vendorKey(vendor);
  if (!key || !isLearnable(category)) return;
  try {
    const admin = getSupabaseAdmin();
    const { data: existing, error: readErr } = await admin
      .from(TABLE)
      .select('category, times_confirmed')
      .eq('organization_id', orgId)
      .eq('vendor_key', key)
      .maybeSingle();
    if (readErr) throw readErr;

    const now = new Date().toISOString();
    if (!existing) {
      const { error } = await admin
        .from(TABLE)
        .insert({ organization_id: orgId, vendor_key: key, category, vendor_label: vendor, times_confirmed: 1, updated_at: now });
      if (error) throw error;
    } else {
      const sameCat = (existing as { category: string }).category === category;
      const prevCount = (existing as { times_confirmed: number }).times_confirmed ?? 1;
      const { error } = await admin
        .from(TABLE)
        .update({ category, vendor_label: vendor, times_confirmed: sameCat ? prevCount + 1 : 1, updated_at: now })
        .eq('organization_id', orgId)
        .eq('vendor_key', key);
      if (error) throw error;
    }
    log.info('vendor_memory_learned', { org: orgId, vendor_key: key, category });
  } catch (err) {
    log.warn('vendor_memory_learn_failed', { message: err instanceof Error ? err.message : 'unknown' });
  }
}

/**
 * Apply any learned mapping for this org+vendor to a fresh categorization. Returns the model's
 * result unchanged when there's no usable vendor key, no learned mapping, or the mapping already
 * agrees. Non-throwing — on any DB error we degrade to the model's pick.
 */
export async function applyVendorMemory(orgId: string, vendor: string | null, result: CategoryResult): Promise<CategoryResult> {
  const key = vendorKey(vendor);
  if (!key) return result;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .select('category')
      .eq('organization_id', orgId)
      .eq('vendor_key', key)
      .maybeSingle();
    if (error) throw error;
    const memoryCategory = (data as { category: string } | null)?.category ?? null;
    const applied = applyMemoryToResult(memoryCategory, result, vendor);
    if (applied.fromMemory) {
      log.info('vendor_memory_applied', { org: orgId, vendor_key: key, from: result.category, to: applied.category });
    }
    return applied;
  } catch (err) {
    log.warn('vendor_memory_apply_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return result;
  }
}
