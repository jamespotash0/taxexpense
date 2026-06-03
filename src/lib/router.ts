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
import { listReceipts, updateReceipt } from './receipts';
import { formatMoney } from './format';
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
  | { kind: 'help' };

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
- "help": a greeting, "help", or "what can you do".

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

// "Flag this for my CPA" — the only mutation the router does (low-risk boolean on the most
// recent receipt; DEC-038). Regex-gated so it never needs the classifier.
const FLAG_CPA_RE = /\bflag\b|\bcpa\b/i;

/** Mark the user's most recent expense for CPA review; it then shows on the export. */
async function flagLatestForCpa(user: AppUser): Promise<ProcessResult> {
  const { rows } = await listReceipts(user.organization_id, { limit: 1 });
  const r = rows[0];
  if (!r) return reply("I don't see an expense to flag yet — text me one first.");
  const name = `${r.vendor ?? 'your last expense'} ${formatMoney(r.amount_cents)}`;
  if (r.flagged_for_cpa) return reply(`${name} is already flagged for your CPA — it'll show on the export.`);
  await updateReceipt(user.organization_id, r.id, { flagged_for_cpa: true });
  return reply(`✓ Flagged ${name} for your CPA. It'll be marked on your export so they can weigh in.`);
}

/**
 * Try to handle a text message conversationally. Returns a ProcessResult to send, or
 * null to let the caller run the normal expense-capture flow. Read-only except the
 * explicit "flag for CPA" marker.
 */
export async function routeTextMessage(user: AppUser, text: string): Promise<ProcessResult | null> {
  // Obvious expense → straight to capture, no classifier call.
  if (looksLikeExpenseCapture(text)) return null;

  // "Flag for my CPA" → mark the latest expense (deterministic, no classifier).
  if (FLAG_CPA_RE.test(text)) return flagLatestForCpa(user);

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
  }
}
