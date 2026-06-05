// Conversational SMS router (DEC-029). Sits in front of the capture flow on the
// non-photo text path. Classifies an inbound message and either (a) answers a read-only
// QUERY about the user's expenses, (b) handles a safe COMMAND, (c) deflects an ADVICE
// question to a CPA, or (d) returns null to let the existing capture workflow run.
//
// GUARDRAILS (DEC-029):
//   • Read-only. No edits/deletes here. The only outward action (email accountant) is a
//     pointer to the dashboard, not an SMS-triggered send (deferred).
//   • Numbers come from lib/queries.ts (DB), never the model. The model only picks intent
//     + params; the reply templates render the figures.
//   • Tax-advice / tax-owed questions are refused with a CPA deferral (CLAUDE.md #1/#7).
//   • On any classifier failure or low confidence → treat as capture (the core path).

import { claudeJSON } from './llm';
import { HAIKU_MODEL } from './claude';
import { PUBLIC_ENV } from './env';
import { log } from './log';
import { getSupabaseAdmin } from './supabase';
import { listReceipts, updateReceipt, getReceipt, type ReceiptRow } from './receipts';
import { formatMoney, shortDate } from './format';
import type { AppUser } from './users';
import type { ProcessResult } from './expense';
import {
  aggregateExpenses,
  categoryBreakdown,
  recentExpenses,
  normalizeCategory,
  isPeriodKey,
  formatAggregate,
  formatBreakdown,
  formatRecent,
  type PeriodKey,
} from './queries';
import { reviewYear, formatYearReview, defaultReviewYear } from './year-review';

export type QueryTool = 'aggregate' | 'breakdown' | 'recent' | 'review_year';
export type CommandName = 'export' | 'email_accountant';

export type Intent =
  | { kind: 'capture' }
  | { kind: 'query'; tool: QueryTool; category: string | null; period?: PeriodKey; count?: number }
  | { kind: 'command'; command: CommandName }
  | { kind: 'advice' }
  | { kind: 'help' }
  | { kind: 'other' };

const QUERY_TOOLS: QueryTool[] = ['aggregate', 'breakdown', 'recent', 'review_year'];
const COMMANDS: CommandName[] = ['export', 'email_accountant'];

// ---------------------------------------------------------------------------
// Fast path (pure) — obvious expense captures skip the classifier entirely
// (saves a Claude call + avoids ever mis-routing a real expense to a query).
// ---------------------------------------------------------------------------

const QUESTION_RE = /\?|\b(how much|how many|what'?s?|when|show|list|total|breakdown|review|export|email|spent|deductible|owe)\b/i;
const AMOUNT_RE = /(\$\s?\d|\b\d+(\.\d{1,2})?\s?(dollars|bucks)\b)/i;
const MILES_RE = /\b(\d+(\.\d+)?\s?(mi|mile|miles)|drove)\b/i;

/** True when the text clearly records a new expense and is NOT phrased as a question. */
export function looksLikeExpenseCapture(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (QUESTION_RE.test(t)) return false;
  return AMOUNT_RE.test(t) || MILES_RE.test(t);
}

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

const CLASSIFY_PROMPT = `You route inbound text messages for Tally, an expense logger people text. Classify the message into exactly one intent and return ONLY JSON.

Intents:
- "capture": the message RECORDS a new expense (a purchase, an amount, miles driven, a receipt note). When in doubt, choose capture.
- "query": the user ASKS about expenses they already logged — totals, how much they spent, their latest/recent charges, a category breakdown, or a year review.
- "command": an explicit request to "export" their data or "email my accountant".
- "advice": asks for TAX ADVICE — what they'll owe, whether something is deductible, what they should do. (Tally does not give advice.)
- "help": a greeting ("hi", "hey", "thanks"), "help", or "what can you do".
- "other": the message is off-topic or something Tally can't do — it is NOT an expense, NOT a question about their own logged expenses, NOT a command, NOT tax advice, and NOT a greeting/help. (e.g. "what's the weather", "book me a flight", "write me a poem".) Only use this when the message clearly has nothing to do with logging or reviewing expenses. When unsure whether it's an expense, choose "capture", not "other".

For "query", also set:
- "tool": one of "aggregate" (a total / how much), "breakdown" (spend by category), "recent" (latest/last N charges), "review_year" (review my year / year summary).
- "category": the spending category named, else null (e.g. "meals", "software", "travel", "gas").
- "period": one of "this_month","last_month","this_quarter","this_year","last_year","all", else null.
- "count": for "recent", how many they asked for (e.g. 3), else null.

For "command", set "command": "export" or "email_accountant".

Return ONLY:
{"intent":"...","tool":null,"category":null,"period":null,"count":null,"command":null}`;

interface RawIntent {
  intent?: string;
  tool?: string | null;
  category?: string | null;
  period?: string | null;
  count?: number | null;
  command?: string | null;
}

/** Clamp a model's raw output to a safe, validated Intent (pure). */
export function sanitizeIntent(raw: RawIntent): Intent {
  switch (raw.intent) {
    case 'query': {
      const tool: QueryTool = QUERY_TOOLS.includes(raw.tool as QueryTool) ? (raw.tool as QueryTool) : 'aggregate';
      const period = isPeriodKey(raw.period ?? undefined) ? (raw.period as PeriodKey) : undefined;
      // Only keep a category the catalog actually recognizes; else treat as "all".
      const category = normalizeCategory(raw.category) ? (raw.category as string) : null;
      const count = typeof raw.count === 'number' && raw.count > 0 ? Math.min(Math.floor(raw.count), 10) : undefined;
      return { kind: 'query', tool, category, period, count };
    }
    case 'command': {
      if (COMMANDS.includes(raw.command as CommandName)) return { kind: 'command', command: raw.command as CommandName };
      return { kind: 'help' };
    }
    case 'advice':
      return { kind: 'advice' };
    case 'help':
      return { kind: 'help' };
    case 'other':
      return { kind: 'other' };
    case 'capture':
    default:
      return { kind: 'capture' };
  }
}

/** Classify a message. Any LLM/parse failure falls back to capture (the core path). */
export async function classifyIntent(text: string): Promise<Intent> {
  try {
    const raw = await claudeJSON<RawIntent>({
      model: HAIKU_MODEL,
      system: CLASSIFY_PROMPT,
      userText: text,
      cacheSystem: true,
      maxTokens: 200,
    });
    return sanitizeIntent(raw);
  } catch (err) {
    log.warn('router_classify_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return { kind: 'capture' };
  }
}

// ---------------------------------------------------------------------------
// Replies for non-query intents
// ---------------------------------------------------------------------------

function reply(smsText: string): ProcessResult {
  return { smsText, receiptId: null, contextState: null };
}

function appBase(): string {
  return PUBLIC_ENV.appUrl || 'https://tallywhy.com';
}

const ADVICE_DEFLECTION =
  "I keep your records, not tax advice — for what you'll owe or whether something's deductible, check with a CPA. " +
  'But I can tell you what you\'ve logged: try "how much on meals this year?" or "review my year".';

const HELP_TEXT =
  'Text me an expense to log it (e.g. "$30 gas to client site"). Or ask me things like:\n' +
  '• "how much have I spent on meals this year?"\n' +
  '• "what are my last 3 charges?"\n' +
  '• "review my year"';

// Off-topic / unprocessable message (DEC-029): say plainly we can't do it, then point back to
// the one thing we do. Distinct from HELP_TEXT, which still greets a "hi" / "what can you do".
const CANT_HELP_TEXT =
  "Sorry, I can't help with that — I'm built to log business expenses. " +
  'Text me one like "$30 gas to client site" and I\'ll take it from there.';

function commandReply(user: AppUser, command: CommandName): ProcessResult {
  const base = appBase();
  if (command === 'email_accountant') {
    return reply(
      user.accountant_email
        ? `You can email this year's records to ${user.accountant_email} from your dashboard: ${base}/dashboard`
        : `Add your accountant's email in Settings, then you can send your records in one tap: ${base}/dashboard`,
    );
  }
  // export
  return reply(`Export a CSV or QuickBooks file anytime from your dashboard: ${base}/dashboard`);
}

// ---------------------------------------------------------------------------
// Query dispatch — every number comes from lib/queries.ts (numbers-from-DB).
// ---------------------------------------------------------------------------

async function runQuery(orgId: string, intent: Extract<Intent, { kind: 'query' }>): Promise<ProcessResult> {
  switch (intent.tool) {
    case 'recent': {
      const rows = await recentExpenses(orgId, intent.count ?? 3);
      return reply(formatRecent(rows));
    }
    case 'breakdown': {
      const { rows, periodLabel } = await categoryBreakdown(orgId, intent.period);
      return reply(formatBreakdown(rows, periodLabel));
    }
    case 'review_year': {
      const review = await reviewYear(orgId, defaultReviewYear());
      return reply(formatYearReview(review, `${appBase()}/dashboard/cleanup`));
    }
    case 'aggregate':
    default: {
      const result = await aggregateExpenses(orgId, { period: intent.period, category: intent.category });
      return reply(formatAggregate(result));
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// "Flag for my CPA" — the router's only mutation (low-risk boolean; DEC-038/039). Regex-gated,
// no classifier. Targets by amount/vendor; asks "which one?" when ambiguous.
const FLAG_CPA_RE = /\bflag\b|\bcpa\b/i;

export interface FlagTarget {
  amountCents?: number;
  term?: string;
}

/** Pull an amount and/or a vendor/keyword out of a "flag the $48 lunch" message (pure). */
export function parseFlagTarget(text: string): FlagTarget {
  // Strip command/filler words so the leftover reads as a vendor/keyword.
  const stripped = text
    .replace(/['’]/g, '') // keep "Morton's" → "Mortons" (don't split the vendor)
    .replace(/\b(flag|flagged|please|the|this|that|it|for|my|to|review|cpa|accountant|ask|have|look|at|one|expense)\b/gi, ' ')
    .replace(/[^\w$.\s]/g, ' ');
  const amountMatch = stripped.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const amountCents = amountMatch ? Math.round(parseFloat(amountMatch[1]) * 100) : undefined;
  const term = stripped
    .replace(/\$?\s*\d+(?:\.\d{1,2})?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { amountCents, term: term.length >= 2 ? term : undefined };
}

/** Find receipts matching a flag target (amount exact, term ILIKE vendor/purpose/attendees). */
async function findFlagCandidates(orgId: string, target: FlagTarget): Promise<ReceiptRow[]> {
  let q = getSupabaseAdmin()
    .from('receipts')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(8);
  if (target.amountCents != null) q = q.eq('amount_cents', target.amountCents);
  if (target.term) {
    const safe = target.term.replace(/[^a-z0-9 ]/gi, '').trim(); // keep the PostgREST .or filter safe
    if (safe) q = q.or(`vendor.ilike.%${safe}%,business_purpose.ilike.%${safe}%,attendees.ilike.%${safe}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data as ReceiptRow[]) ?? [];
}

async function flagOne(user: AppUser, r: ReceiptRow): Promise<ProcessResult> {
  const name = `${r.vendor ?? 'your expense'} ${formatMoney(r.amount_cents)}`;
  if (r.flagged_for_cpa) return reply(`${name} is already flagged for your CPA — it'll show on the export.`);
  await updateReceipt(user.organization_id, r.id, { flagged_for_cpa: true });
  return reply(`✓ Flagged ${name} for your CPA. It'll be marked on your export so they can weigh in.`);
}

async function flagLatest(user: AppUser): Promise<ProcessResult> {
  const { rows } = await listReceipts(user.organization_id, { limit: 1 });
  if (!rows[0]) return reply("I don't see an expense to flag yet — text me one first.");
  return flagOne(user, rows[0]);
}

/** Flag for CPA: target by amount/vendor → flag if unique, ask to pick if ambiguous, else latest. */
async function flagForCpa(user: AppUser, text: string): Promise<ProcessResult> {
  const target = parseFlagTarget(text);
  if (target.amountCents == null && !target.term) return flagLatest(user);

  const candidates = await findFlagCandidates(user.organization_id, target);
  if (candidates.length === 0) {
    return reply(
      'I couldn’t find that one. Try the amount ("flag the $48 one") or the vendor — or flag specific expenses in your dashboard.',
    );
  }
  if (candidates.length === 1) return flagOne(user, candidates[0]);

  const list = candidates.slice(0, 5);
  const lines = list.map((r, i) => `${i + 1}) ${r.vendor ?? 'Unknown'} ${formatMoney(r.amount_cents)}${shortDate(r.transaction_date)}`);
  return {
    smsText: `I found a few — which should I flag for your CPA?\n${lines.join('\n')}\nReply with a number.`,
    receiptId: null,
    contextState: 'awaiting_flag_choice',
    pendingData: { candidateIds: list.map((r) => r.id) },
  };
}

/** Resolve a "1/2/3" reply to a flag-disambiguation prompt → flag the chosen candidate. */
export async function resolveFlagChoice(user: AppUser, candidateIds: string[], choice: number): Promise<ProcessResult> {
  if (!Number.isInteger(choice) || choice < 1 || choice > candidateIds.length) {
    return reply(`Reply with a number 1-${candidateIds.length} to flag one for your CPA.`);
  }
  const r = await getReceipt(user.organization_id, candidateIds[choice - 1]);
  if (!r) return reply("That one's no longer available — try again or use the dashboard.");
  return flagOne(user, r);
}

/**
 * Try to handle a text message conversationally. Returns a ProcessResult to send, or
 * null to let the caller run the normal expense-capture flow. Read-only except the
 * explicit "flag for CPA" marker.
 */
export async function routeTextMessage(user: AppUser, text: string): Promise<ProcessResult | null> {
  // Obvious expense → straight to capture, no classifier call.
  if (looksLikeExpenseCapture(text)) return null;

  // "Flag for my CPA" → target by amount/vendor, ask to pick if ambiguous (no classifier).
  if (FLAG_CPA_RE.test(text)) return flagForCpa(user, text);

  const intent = await classifyIntent(text);
  switch (intent.kind) {
    case 'capture':
      return null;
    case 'query':
      return runQuery(user.organization_id, intent);
    case 'command':
      return commandReply(user, intent.command);
    case 'advice':
      return reply(ADVICE_DEFLECTION);
    case 'help':
      return reply(HELP_TEXT);
    case 'other':
      return reply(CANT_HELP_TEXT);
  }
}
