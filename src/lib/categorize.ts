// LLM wrappers for categorization (Prompt 6, Haiku) and SMS composition (Prompt 2,
// Sonnet). Per DEC-011 these do NOT decide substantiation — composeResponse receives
// the already-computed decision and only phrases it.
// OWNER: Raj + Priya (categorize), Sofia (response wording).

import { claudeJSON, claudeText, type CallMeta } from './llm';
import { HAIKU_MODEL, OPUS_MODEL, SONNET_MODEL } from './claude';
import { CATEGORIZATION_HELPER_PROMPT, CATEGORIZATION_RESPONSE_PROMPT } from './prompts';
import { canonicalizeCategory } from './categories';
import { renderProfileForPrompt } from './businessProfile';
import { log } from './log';
import { PUBLIC_ENV, optionalEnv } from './env';
import type { AppUser } from './users';
import type { SubstantiationRule, SubstantiationResult } from './substantiation';
import type { IrcSummary } from './irc';

/** Canonical expense data flowing through categorize → decision → save. */
export interface ExpenseInput {
  amount_cents: number | null;
  vendor: string | null;
  transaction_date: string | null; // YYYY-MM-DD
  attendees: string | null;
  business_purpose: string | null;
  business_relationship: string | null;
  location_city: string | null;
  business_miles: number | null;
  has_photo: boolean;
  raw_text: string | null;
  items: string[];
}

export interface CategoryResult {
  category: string;
  confidence: number;
  reasoning: string;
  /** True when the raw LLM category was unknown and coerced to the 'other_business' catch-all
   *  (DEC-065). Surfaced to the review floor so a drifted expense gets a human glance. */
  drifted?: boolean;
  /** True when this category came from per-org vendor memory (DEC-070), overriding the model's
   *  pick because the user previously corrected this vendor. See lib/vendor-memory.ts. */
  fromMemory?: boolean;
}

export function userContextLine(user: AppUser): string {
  // Quoted + labeled: it's the user's own free text, so the model reads it as data, not instructions.
  const work = user.business_type ? JSON.stringify(user.business_type) : 'unknown';
  let base = `Business type (user's own words): ${work}; Entity: ${user.entity_type ?? 'unknown'}`;
  if (user.work_location && user.work_location !== 'unknown') base += `; Works from: ${user.work_location}`;
  if (user.drives_for_work != null) base += `; Drives for work: ${user.drives_for_work ? 'yes' : 'no'}`;
  // Profession-aware prior (Spec 09): when present, append the structured profile so every
  // categorization path (standalone, merged OCR/text, and the response composer) sees it. Absent
  // → unchanged behavior. This is the single seam all four call sites funnel through.
  return user.business_profile ? `${base}\n${renderProfileForPrompt(user.business_profile)}` : base;
}

/** Coerce a raw LLM category payload into a safe CategoryResult (shared by the standalone
 *  categorizer and the merged extract+categorize calls so defaults stay consistent). */
export function normalizeCategoryResult(raw: {
  category?: string;
  confidence?: number;
  reasoning?: string;
}): CategoryResult {
  // Enforce the closed taxonomy (DEC-065). The model is told never to invent a category, but
  // nothing structurally stopped a hallucinated label from leaking to the dashboard + CSV export
  // as a one-off column. canonicalizeCategory coerces any unknown value into the controlled
  // 'other_business' bucket; we emit a metric so drift is visible instead of silent.
  const canon = canonicalizeCategory(raw.category);
  const drifted = canon.status === 'drift';
  if (drifted) {
    // Warn-level + structured so it's an alertable abuse signal, not just noise: a spike in drift
    // is a leading indicator of prompt-injection trying to escape the closed taxonomy (Jordan).
    log.warn('category_drift', { raw_category: raw.category ?? null, coerced_to: canon.category });
  }
  return {
    category: canon.category,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0,
    reasoning: raw.reasoning ?? '',
    drifted,
  };
}

// The not-advice + CPA deferral — the LEGAL control (CLAUDE.md rules 5/7). Lives in ONE place so
// the floor is a single source of truth the test can assert against. Appended in code on EVERY
// tax-guidance reply (DEC-065b-i / Jordan) — never left to the model.
export const DISCLAIMER_LINE = 'Suggestion, not advice. Confirm with your CPA.';

/**
 * The INLINE IRC citation woven into the body where the section is referenced — e.g.
 * "§274 (https://tallywhy.com/irc/274)" — rather than a detached trailing line that re-cites the
 * section (DEC-067). The URL stays code-controlled: the model is handed this exact string and
 * forbidden from inventing URLs; composeResponse re-inserts it as a backstop if the model drops it.
 * Returns null when there's no section to cite. Pure + testable.
 */
export function ircCitation(opts: { sectionId: string | null; appUrl?: string }): string | null {
  if (!opts.sectionId) return null;
  const base = opts.appUrl || PUBLIC_ENV.appUrl || 'https://tallywhy.com';
  return `§${opts.sectionId} (${base}/irc/${opts.sectionId})`;
}

/**
 * Append the legal disclaimer (DEC-065b-i, narrowed by DEC-109). Added in code, never by the model.
 * Routine logs skip it; it rides on strict-category logs (meals, travel, gifts, vehicle), where the
 * deduction rules are the closest thing to advice. Welcome, HELP and tax-question replies carry
 * their own not-advice line. Pure + testable.
 */
export function withDisclaimer(message: string): string {
  return `${message.trimEnd()}\n\n${DISCLAIMER_LINE}`;
}

/** DEC-109: disclaimer only on strict-substantiation categories. */
export function disclaimerIfStrict(message: string, level: 'strict' | 'general'): string {
  return level === 'strict' ? withDisclaimer(message) : message;
}

function expenseSummary(input: ExpenseInput): string {
  const dollars = input.amount_cents != null ? `$${(input.amount_cents / 100).toFixed(2)}` : 'unknown amount';
  return [
    `Vendor: ${input.vendor ?? 'unknown'}`,
    `Amount: ${dollars}`,
    input.items.length ? `Items: ${input.items.join(', ')}` : null,
    input.business_purpose ? `Context: ${input.business_purpose}` : null,
    input.attendees ? `Attendees: ${input.attendees}` : null,
    input.location_city ? `Location: ${input.location_city}` : null,
    input.business_miles != null ? `Miles: ${input.business_miles}` : null,
    input.raw_text ? `Original text: ${input.raw_text}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Prompt 6 — map an expense to one canonical category string (Haiku).
 *  @param onMeta optional cost/latency sink for the AI eval log (DEC-080). */
export async function categorizeExpense(
  input: ExpenseInput,
  user: AppUser,
  onMeta?: (m: CallMeta) => void,
): Promise<CategoryResult> {
  const result = await claudeJSON<Partial<CategoryResult>>({
    model: HAIKU_MODEL,
    system: CATEGORIZATION_HELPER_PROMPT,
    userText: `## User Context\n${userContextLine(user)}\n\n## Expense\n${expenseSummary(input)}`,
    cacheSystem: true,
    maxTokens: 1024,
    onMeta,
  });
  return normalizeCategoryResult(result);
}

/** Second opinion on an uncertain category: same prompt, stronger model. Only called when the
 *  first guess is below the review floor (~5-10% of expenses). Returns null on any failure so the
 *  caller keeps the first guess; it never blocks logging. */
export async function secondOpinionCategory(input: ExpenseInput, user: AppUser): Promise<CategoryResult | null> {
  try {
    const result = await claudeJSON<Partial<CategoryResult>>({
      model: OPUS_MODEL,
      system: CATEGORIZATION_HELPER_PROMPT,
      userText: `## User Context\n${userContextLine(user)}\n\n## Expense\n${expenseSummary(input)}`,
      cacheSystem: true,
      maxTokens: 4096, // Opus thinking counts toward this
    });
    return normalizeCategoryResult(result);
  } catch (err) {
    log.warn('category_second_opinion_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return null;
  }
}

/**
 * Prompt 2 — compose the SMS reply consistent with the already-computed decision.
 * The decision flags are authoritative (DEC-011); the model only phrases them.
 */
export async function composeResponse(args: {
  input: ExpenseInput;
  category: string;
  rule: SubstantiationRule;
  decision: SubstantiationResult;
  irc: IrcSummary | null;
  user: AppUser;
  /** Confidence-gated category micro-confirm (DEC-073): when true, the model adds ONE short line
   *  inviting the user to reply with the right category if it's off. Only set on an otherwise-clean
   *  log where the categorizer was genuinely unsure — never stacked on a receipt/context question. */
  categoryUncertain?: boolean;
  /** Override the compose model (eval/AB). Defaults to COMPOSE_MODEL env, else Sonnet. The phrasing
   *  task is post-decision (DEC-011), so it's the safe call to try on Haiku — flip via env to A/B in
   *  prod without a redeploy. */
  model?: string;
}): Promise<string> {
  const { input, category, rule, decision, irc, user, categoryUncertain } = args;
  const model = args.model ?? optionalEnv('COMPOSE_MODEL') ?? SONNET_MODEL;

  const decisionBlock = JSON.stringify(
    {
      category,
      irc_section: rule.irc_section,
      deduction_percentage: decision.deduction_percentage,
      needs_receipt: decision.needs_receipt,
      receipt_reason: decision.receipt_reason,
      missing_context_fields: decision.missing_context_fields,
      substantiation_complete: decision.substantiation_complete,
      category_uncertain: categoryUncertain ?? false,
      deduction_cap: rule.deduction_cap_cents != null ? `$${rule.deduction_cap_cents / 100}` : null,
    },
    null,
    2,
  );

  const ircBlock = irc
    ? `IRC §${irc.section_id} (${irc.title}): ${irc.short_summary}`
    : 'No IRC summary available.';

  // The section actually applied + its inline citation snippet (section number + tap-through link).
  // We hand the model the EXACT string to drop in so the link rides along inline at the point of
  // citation (DEC-067) while the URL stays code-controlled — the model never invents a URL.
  const sectionId = irc?.section_id ?? rule.irc_section ?? null;
  const citation = ircCitation({ sectionId });

  const userText = [
    `## User Context`,
    `${userContextLine(user)}; Default payment: ${user.default_payment_account ?? 'unknown'}`,
    `Your name (what this user calls you): ${user.agent_name ?? 'Penny'}`,
    ``,
    `## Expense`,
    expenseSummary(input),
    ``,
    `## Authoritative Decision (final — phrase the SMS to match, do not recompute)`,
    decisionBlock,
    ``,
    `## IRC Summary`,
    ircBlock,
    ``,
    `## IRC Citation (include this EXACT text inline where you reference the section — once)`,
    citation ?? '(no section — do not cite one or write any URL)',
    ``,
    `Write the SMS now.`,
  ].join('\n');

  let message = await claudeText({
    model,
    system: CATEGORIZATION_RESPONSE_PROMPT,
    userText,
    cacheSystem: true,
    maxTokens: 512,
  });

  // Backstop (DEC-067 / Jordan): the inline citation+link rides along on EVERY categorized expense.
  // The model is instructed to weave the exact citation snippet into the body; if it dropped the
  // link we re-attach it so the reference is never lost. The URL always matches the section applied.
  if (citation && !message.includes(`/irc/${sectionId}`)) {
    message = `${message.trimEnd()} ${citation}`;
  }
  // The not-advice + CPA deferral is appended in code (never model-dependent), strict categories only.
  return disclaimerIfStrict(message, rule.substantiation_level);
}
