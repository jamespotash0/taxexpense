// LLM wrappers for categorization (Prompt 6, Haiku) and SMS composition (Prompt 2,
// Sonnet). Per DEC-011 these do NOT decide substantiation — composeResponse receives
// the already-computed decision and only phrases it.
// OWNER: Raj + Priya (categorize), Sofia (response wording).

import { claudeJSON, claudeText } from './llm';
import { HAIKU_MODEL, SONNET_MODEL } from './claude';
import { CATEGORIZATION_HELPER_PROMPT, CATEGORIZATION_RESPONSE_PROMPT } from './prompts';
import { canonicalizeCategory } from './categories';
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
}

export function userContextLine(user: AppUser): string {
  return `Business type: ${user.business_type ?? 'unknown'}; Entity: ${user.entity_type ?? 'unknown'}`;
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
// the floor is a single source of truth the test can assert against.
const NOT_ADVICE = 'suggestion, not advice — confirm with your CPA';

/**
 * The deterministic closing line appended to every tax-guidance SMS (DEC-065b-i / Jordan).
 * INVARIANT: the not-advice disclaimer is present on EVERY return path, by construction — never
 * left to the model. The tap-through IRC link is param-driven (includeLink): the categorized-
 * response path passes true so the link rides along on EVERY expense; the flag stays so callers
 * that don't want a link (or have no section) can omit it. The link carries no legal weight, so
 * including/dropping it needs no legal sign-off; the disclaimer is never dropped here. Pure + testable.
 */
export function closingLine(opts: { sectionId: string | null; includeLink: boolean; appUrl?: string }): string {
  const base = opts.appUrl || PUBLIC_ENV.appUrl || 'https://tallywhy.com';
  if (opts.sectionId && opts.includeLink) {
    return `§${opts.sectionId} in plain English (${NOT_ADVICE}): ${base}/irc/${opts.sectionId}`;
  }
  if (opts.sectionId) {
    return `Per §${opts.sectionId} — ${NOT_ADVICE}.`;
  }
  return `Suggestion, not advice — confirm with your CPA.`;
}

function expenseSummary(input: ExpenseInput): string {
  const dollars = input.amount_cents != null ? `$${(input.amount_cents / 100).toFixed(2)}` : 'unknown amount';
  return [
    `Vendor: ${input.vendor ?? 'unknown'}`,
    `Amount: ${dollars}`,
    input.items.length ? `Items: ${input.items.join(', ')}` : null,
    input.business_purpose ? `Context: ${input.business_purpose}` : null,
    input.attendees ? `Attendees: ${input.attendees}` : null,
    input.business_miles != null ? `Miles: ${input.business_miles}` : null,
    input.raw_text ? `Original text: ${input.raw_text}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Prompt 6 — map an expense to one canonical category string (Haiku). */
export async function categorizeExpense(input: ExpenseInput, user: AppUser): Promise<CategoryResult> {
  const result = await claudeJSON<Partial<CategoryResult>>({
    model: HAIKU_MODEL,
    system: CATEGORIZATION_HELPER_PROMPT,
    userText: `## User Context\n${userContextLine(user)}\n\n## Expense\n${expenseSummary(input)}`,
    cacheSystem: true,
    maxTokens: 256,
  });
  return normalizeCategoryResult(result);
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
  /** Override the compose model (eval/AB). Defaults to COMPOSE_MODEL env, else Sonnet. The phrasing
   *  task is post-decision (DEC-011), so it's the safe call to try on Haiku — flip via env to A/B in
   *  prod without a redeploy. */
  model?: string;
}): Promise<string> {
  const { input, category, rule, decision, irc, user } = args;
  const model = args.model ?? optionalEnv('COMPOSE_MODEL') ?? SONNET_MODEL;

  const decisionBlock = JSON.stringify(
    {
      category,
      irc_section: rule.irc_section,
      deduction_percentage: decision.deduction_percentage,
      deductible_amount: `$${(decision.deductible_amount_cents / 100).toFixed(2)}`,
      needs_receipt: decision.needs_receipt,
      receipt_reason: decision.receipt_reason,
      missing_context_fields: decision.missing_context_fields,
      substantiation_complete: decision.substantiation_complete,
      deduction_cap: rule.deduction_cap_cents != null ? `$${rule.deduction_cap_cents / 100}` : null,
    },
    null,
    2,
  );

  const ircBlock = irc
    ? `IRC §${irc.section_id} (${irc.title}): ${irc.short_summary}`
    : 'No IRC summary available.';

  const userText = [
    `## User Context`,
    `${userContextLine(user)}; Default payment: ${user.default_payment_account ?? 'unknown'}`,
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
    `Write the SMS now.`,
  ].join('\n');

  const message = await claudeText({
    model,
    system: CATEGORIZATION_RESPONSE_PROMPT,
    userText,
    cacheSystem: true,
    maxTokens: 512,
  });

  // Deterministic closing line (no extra LLM call). The not-advice disclaimer is always present;
  // the tap-through IRC link rides along on EVERY categorized expense (strict and general alike)
  // so the user always gets the reference. The URL always matches the section actually applied.
  const sectionId = irc?.section_id ?? rule.irc_section ?? null;
  return `${message}\n\n${closingLine({ sectionId, includeLink: true })}`;
}
