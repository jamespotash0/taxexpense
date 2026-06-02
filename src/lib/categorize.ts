// LLM wrappers for categorization (Prompt 6, Haiku) and SMS composition (Prompt 2,
// Sonnet). Per DEC-011 these do NOT decide substantiation — composeResponse receives
// the already-computed decision and only phrases it.
// OWNER: Raj + Priya (categorize), Sofia (response wording).

import { claudeJSON, claudeText } from './llm';
import { HAIKU_MODEL, SONNET_MODEL } from './claude';
import { CATEGORIZATION_HELPER_PROMPT, CATEGORIZATION_RESPONSE_PROMPT } from './prompts';
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
}

function userContextLine(user: AppUser): string {
  return `Business type: ${user.business_type ?? 'unknown'}; Entity: ${user.entity_type ?? 'unknown'}`;
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
  return {
    category: result.category ?? 'personal',
    confidence: typeof result.confidence === 'number' ? result.confidence : 0,
    reasoning: result.reasoning ?? '',
  };
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
}): Promise<string> {
  const { input, category, rule, decision, irc, user } = args;

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

  return claudeText({
    model: SONNET_MODEL,
    system: CATEGORIZATION_RESPONSE_PROMPT,
    userText,
    cacheSystem: true,
    maxTokens: 512,
  });
}
