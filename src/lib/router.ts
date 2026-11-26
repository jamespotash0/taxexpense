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

import { claudeJSON, claudeText } from './llm';
import { HAIKU_MODEL } from './claude';
import { PUBLIC_ENV } from './env';
import { log } from './log';
import { getSupabaseAdmin } from './supabase';
import { listReceipts, updateReceipt, getReceipt, listRecentReceiptsSince, countFlaggedReceipts, waiveAllFlaggedReceipts, type ReceiptRow } from './receipts';
import { formatMoney, shortDate } from './format';
import { pickReceiptForContext, contextChoiceMessage, withExpenseName } from './context-match';
import { updateUser, type AppUser } from './users';
import { parseAgentName } from './onboarding';
import { DEFAULT_AGENT_NAME } from './prompts';
import { processCorrection, type ProcessResult } from './expense';
import type { TurnContext, TurnDecision } from './turn';
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
  | { kind: 'capability' }
  | { kind: 'context_statement' }
  // The user is responding about expenses still missing a receipt — "none" = they won't/can't
  // provide one (waive), "later" = they'll send it (keep flagged). Only valid with receipt context.
  | { kind: 'receipt_resolution'; resolution: 'none' | 'later' }
  | { kind: 'other' };

/** Lightweight conversation state the classifier reasons WITH (kept out of the cached system prompt;
 *  passed per-message). Today: whether the user has receipts still missing a photo. */
export interface ReplyContext {
  flaggedCount: number;
  awaitingReceipt?: boolean;
}

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
- "capability": asks HOW TALLY WORKS or whether it CAN DO something — a question about the product/feature itself, not their data and not tax advice. (e.g. "can I set the date on an expense?", "does it only log for today?", "can you read receipts?", "do you handle mileage?", "how do I correct one?", "can I export to QuickBooks?")
- "help": a greeting ("hi", "hey", "thanks"), bare "help", or the open-ended "what can you do".
- "context_statement": a STATEMENT (not a question) that ADDS A BUSINESS DETAIL or correction about an expense the user just logged — who was at a meal, the business purpose, where it was, that it was business or personal, or a clarification about the vendor — WITHOUT stating a new amount and WITHOUT being a fresh expense. (e.g. "that lunch was with a client about the Q3 deal", "the dinner was for my own team", "that one was actually personal", "Tabernacle is a restaurant".) This INCLUDES short or imperative fixes to the last expense's category: "log as business expense", "business", "it's for work", "make it software", "personal". Those are never "help". If the message states a NEW dollar amount or miles, it's a "capture", not this. If it asks a question, it's "query"/"advice"/"help", not this.
- "receipt_resolution": ONLY valid when a "CONTEXT:" line below says the user has expenses still missing a receipt. Use it when this message is the user RESPONDING about those missing receipts. Set "resolution":"none" if they won't or can't provide one ("don't have a receipt", "lost it", "threw it out", "no receipt", "skip it", "just have the bank charge", "never got one"). Set "resolution":"later" if they intend to send it ("later", "I'll send it tonight", "not now"). If the message instead ADDS A DETAIL about the expense it's "context_statement"; if it states a new amount/expense it's "capture". If there is NO context line about missing receipts, NEVER use this intent.
- "other": the message is off-topic or something Tally can't do — it is NOT an expense, NOT a question about their own logged expenses, NOT a command, NOT tax advice, NOT a detail about a logged expense, and NOT a greeting/help. (e.g. "what's the weather", "book me a flight", "write me a poem".) Only use this when the message clearly has nothing to do with logging or reviewing expenses. When unsure whether it's an expense, choose "capture", not "other".

A line beginning "CONTEXT:" may precede the user's message (shown after "Message:") — use it to interpret the message, but never classify the context line itself.

For "query", also set:
- "tool": one of "aggregate" (a total / how much), "breakdown" (spend by category), "recent" (latest/last N charges), "review_year" (review my year / year summary).
- "category": the spending category named, else null (e.g. "meals", "software", "travel", "gas").
- "period": one of "this_month","last_month","this_quarter","this_year","last_year","all", else null.
- "count": for "recent", how many they asked for (e.g. 3), else null.

For "command", set "command": "export" or "email_accountant".

For "receipt_resolution", set "resolution": "none" or "later".

Return ONLY:
{"intent":"...","tool":null,"category":null,"period":null,"count":null,"command":null,"resolution":null}`;

interface RawIntent {
  intent?: string;
  tool?: string | null;
  category?: string | null;
  period?: string | null;
  count?: number | null;
  command?: string | null;
  resolution?: string | null;
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
    case 'capability':
      return { kind: 'capability' };
    case 'help':
      return { kind: 'help' };
    case 'context_statement':
      return { kind: 'context_statement' };
    case 'receipt_resolution':
      // Only an explicit "none" waives; anything ambiguous defaults to the safe "later" (keep
      // flagged, just acknowledge) so we never silently stop nudging on a fuzzy classification.
      return { kind: 'receipt_resolution', resolution: raw.resolution === 'none' ? 'none' : 'later' };
    case 'other':
      return { kind: 'other' };
    case 'capture':
    default:
      return { kind: 'capture' };
  }
}

/** Classify a message. Any LLM/parse failure falls back to capture (the core path). */
/** Dynamic per-message context for the classifier. Kept OUT of the cached system prompt and prefixed
 *  to the user message so prompt caching still hits. Empty when there's nothing relevant to add. */
function contextLine(ctx?: ReplyContext): string {
  if (!ctx || ctx.flaggedCount <= 0) return '';
  const n = ctx.flaggedCount;
  const asked = ctx.awaitingReceipt ? ' and was just asked to send one' : '';
  return `CONTEXT: the user has ${n} expense${n === 1 ? '' : 's'} still missing a receipt photo${asked}.`;
}

export async function classifyIntent(text: string, ctx?: ReplyContext): Promise<Intent> {
  const cl = contextLine(ctx);
  const userText = cl ? `${cl}\n\nMessage: ${text}` : text;
  try {
    const raw = await claudeJSON<RawIntent>({
      model: HAIKU_MODEL,
      system: CLASSIFY_PROMPT,
      userText,
      cacheSystem: true,
      maxTokens: 1024,
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

// Receipt-resolution replies (DEC-072/078). Honest about the un-receipted gap for the CPA; never
// claim completeness. bulkWaiveMessage answers a "no receipt" reply to the weekly reminder, which is
// about every flagged receipt at once.
export function bulkWaiveMessage(n: number): string {
  const what = n === 1 ? 'that expense' : `those ${n} expenses`;
  return `Totally fine, I won't ask about ${what} again. Your text is the record, and I noted there's no receipt so it's clear for your accountant. Snap a photo anytime and it'll still attach.`;
}
const RECEIPT_LATER_ACK =
  "No problem! I'll keep those flagged so you can send the photos whenever. Everything else is captured ✓";

const ADVICE_DEFLECTION =
  "I'm your record keeper, not a tax advisor! For what you'll owe or whether something's deductible, check with a CPA. " +
  'But I can tell you what you\'ve logged. Try "how much on meals this year?" or "review my year".';

// Greeting / help. Only onboarding introduces Penny by name; after that she just answers like a
// friend: thanks gets "anytime", a real help question gets the how-to, anything else (hi, hey,
// test) gets a short hello by first name.
export function greetingReply(user: Pick<AppUser, 'full_name'>, text: string): string {
  const t = text.toLowerCase();
  if (/\b(thanks|thank you|thx|ty|appreciate)\b/.test(t)) return 'Anytime! 🙌';
  if (/\b(help|what can you do|how does (this|it) work|how do i)\b/.test(t)) return HELP_TEXT;
  const first = user.full_name?.trim().split(/\s+/)[0];
  return `Hey${first ? ` ${first}` : ''}! 👋 What can I log for you?`;
}

const HELP_TEXT =
  'Text me any expense (a receipt photo or a note like "$30 gas to client site") and I\'ll log it. ' +
  'You can also ask me stuff like "how much on meals this year?" or "review my year".';

// Grounded facts the capability answerer may rely on — keep accurate to the actual product so the
// model never invents a feature. If behavior changes, update this list.
const CAPABILITY_PROMPT = `You are Tally's friendly texting assistant that people text to log business expenses. A user asked how Tally works or whether it can do something. Answer ONLY from the facts below, in ONE short SMS (under 320 characters, plain text, no bullet lists) that sounds like a warm, upbeat friend texting back. Never use em dashes or en dashes. If the question is NOT covered by the facts, do NOT guess. Reply simply that you can't answer that one (e.g. "Hmm, I can't answer that one. I'm built to log business expenses!") and stop there. Never give tax advice; for what's deductible or owed, defer to a CPA.

What Tally can do:
- Log expenses you text — a photo of a receipt, or a quick note like "$30 gas to client site". Reading receipt photos and mileage ("drove 22 miles to client") both work.
- Dates: if you mention a date or the receipt shows one, Tally uses that date; otherwise it defaults to the day you send the message. So yes, an expense can be dated to a specific day — just include the date (e.g. "$40 lunch on June 1"). It is NOT locked to "today".
- Categorize each expense under the right IRC section, and ask for extra context only when IRS substantiation rules require it (meals, travel, lodging, business gifts, vehicle).
- Corrections: text a correction right after and Tally updates that expense (e.g. "that lunch was with a client about Q3", "that one was personal", "the date was actually May 2").
- Answer questions about what you've logged: totals, category breakdowns, recent charges, a year review.
- Flag an expense for your CPA by text ("flag the $48 lunch").
- Export CSV or QuickBooks files, and email your accountant — both from your dashboard.

What Tally does NOT do: give tax advice, file taxes, or link to your bank.

Answer the user's question directly and concisely.`;

// Off-topic / unprocessable message (DEC-029): say plainly we can't do it, then point back to
// the one thing we do. Distinct from HELP_TEXT, which still greets a "hi" / "what can you do".
const CANT_HELP_TEXT =
  "Ha, wish I could help with that! I'm built to log business expenses though. " +
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
  return reply(`Easy! Grab a CSV or QuickBooks file anytime from your dashboard: ${base}/dashboard`);
}

// ---------------------------------------------------------------------------
// Query dispatch — every number comes from lib/queries.ts (numbers-from-DB).
// ---------------------------------------------------------------------------

// Append a "see them on your dashboard" pointer to a query reply. The dashboard redirects to OTP
// login when there's no session, so this link doubles as the sign-in entry point for SMS users who
// have never opened the web app — answering "what are my expenses?" with both the figures AND a way
// to view/edit them. Omitted when there's nothing logged yet, since there'd be nothing to look at.
function withDashboardLink(smsText: string, hasData: boolean): string {
  if (!hasData) return smsText;
  return `${smsText}\n\nSee them on your dashboard: ${appBase()}/dashboard`;
}

async function runQuery(orgId: string, intent: Extract<Intent, { kind: 'query' }>): Promise<ProcessResult> {
  switch (intent.tool) {
    case 'recent': {
      const rows = await recentExpenses(orgId, intent.count ?? 3);
      return reply(withDashboardLink(formatRecent(rows), rows.length > 0));
    }
    case 'breakdown': {
      const { rows, periodLabel } = await categoryBreakdown(orgId, intent.period);
      return reply(withDashboardLink(formatBreakdown(rows, periodLabel), rows.length > 0));
    }
    case 'review_year': {
      // Year review already carries its own /dashboard/cleanup link, so no extra pointer here.
      const review = await reviewYear(orgId, defaultReviewYear());
      const out = reply(formatYearReview(review, `${appBase()}/dashboard/cleanup`));
      // A clean year with expenses in it earns a little confetti (DEC-087).
      return review.count > 0 && review.issueCount === 0 ? { ...out, effect: 'confetti' } : out;
    }
    case 'aggregate':
    default: {
      const result = await aggregateExpenses(orgId, { period: intent.period, category: intent.category });
      return reply(withDashboardLink(formatAggregate(result), result.count > 0));
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// "Flag for my CPA" — the router's only mutation (low-risk boolean; DEC-038/039). Regex-gated,
// no classifier. Targets by amount/vendor; asks "which one?" when ambiguous.
const FLAG_CPA_RE = /\bflag\b|\bcpa\b/i;

// Talking to the assistant about its name (DEC-086). Deterministic, no classifier call.
const ASK_NAME_RE = /\b(what'?s|what is|whats)\s+(your|ur)\s+name\b|\bwho\s+(are|r)\s+(you|u)\b|\bwhat\s+(should|do)\s+i\s+call\s+(you|u)\b/i;
const RENAME_RE =
  /^\s*(?:can i |i'?ll |i will |let me |i'?m (?:gonna|going to) |i want to )?(?:call you|call u|rename you(?: to)?|change your name to|your name is(?: now)?)\s+(.+)$/i;

/** Is this message asking the assistant's name, or renaming it? Pure + exported for tests. */
export function matchAgentNameMessage(text: string): { kind: 'ask' } | { kind: 'rename'; name: string } | null {
  const rename = RENAME_RE.exec(text);
  if (rename) {
    const name = parseAgentName(rename[1]);
    if (/\p{L}/u.test(name)) return { kind: 'rename', name };
  }
  if (ASK_NAME_RE.test(text)) return { kind: 'ask' };
  return null;
}

async function agentNameReply(user: AppUser, m: { kind: 'ask' } | { kind: 'rename'; name: string }): Promise<ProcessResult> {
  if (m.kind === 'rename') {
    await updateUser(user.id, { agent_name: m.name });
    return reply(`${m.name} it is! 🎉 Love it. Now, got any expenses for me?`);
  }
  const name = user.agent_name ?? DEFAULT_AGENT_NAME;
  return reply(
    `I'm ${name}! 👋 I keep track of your business expenses (and the why behind them) so tax time is easy. ` +
      `Want to call me something else? Just text "call you" and a name.`,
  );
}

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
  if (r.flagged_for_cpa) return reply(`${name} is already flagged for your CPA, so it'll show on the export.`);
  await updateReceipt(user.organization_id, r.id, { flagged_for_cpa: true });
  return reply(`✓ Done! Flagged ${name} for your CPA. It'll be marked on your export so they can weigh in.`);
}

async function flagLatest(user: AppUser): Promise<ProcessResult> {
  const { rows } = await listReceipts(user.organization_id, { limit: 1 });
  if (!rows[0]) return reply("I don't see any expenses to flag yet. Text me one first!");
  return flagOne(user, rows[0]);
}

/** Flag for CPA: target by amount/vendor → flag if unique, ask to pick if ambiguous, else latest. */
async function flagForCpa(user: AppUser, text: string): Promise<ProcessResult> {
  const target = parseFlagTarget(text);
  if (target.amountCents == null && !target.term) return flagLatest(user);

  const candidates = await findFlagCandidates(user.organization_id, target);
  if (candidates.length === 0) {
    return reply(
      'Hmm, I couldn’t find that one. Try the amount ("flag the $48 one") or the vendor, or flag it from your dashboard.',
    );
  }
  if (candidates.length === 1) return flagOne(user, candidates[0]);

  const list = candidates.slice(0, 5);
  const lines = list.map((r, i) => `${i + 1}) ${r.vendor ?? 'Unknown'} ${formatMoney(r.amount_cents)}${shortDate(r.transaction_date)}`);
  return {
    smsText: `I found a few! Which one should I flag for your CPA?\n${lines.join('\n')}\nReply with a number.`,
    receiptId: null,
    contextState: 'awaiting_flag_choice',
    pendingData: { candidateIds: list.map((r) => r.id) },
  };
}

/** Resolve a "1/2/3" reply to a flag-disambiguation prompt → flag the chosen candidate. */
export async function resolveFlagChoice(user: AppUser, candidateIds: string[], choice: number): Promise<ProcessResult> {
  if (!Number.isInteger(choice) || choice < 1 || choice > candidateIds.length) {
    // Keep the list open: only the newest outbound counts as pending (conversations.ts).
    return {
      ...reply(`Reply with a number 1-${candidateIds.length} to flag one for your CPA.`),
      contextState: 'awaiting_flag_choice',
      pendingData: { candidateIds },
    };
  }
  const r = await getReceipt(user.organization_id, candidateIds[choice - 1]);
  if (!r) return reply("Hmm, that one's not there anymore. Try again or use the dashboard.");
  return flagOne(user, r);
}

// A conversational context statement (DEC-069). The user added a business detail about an expense
// they already logged ("that hotel was for the conference", "that one was personal") without
// restating an amount. Find the expense they meant among the last 30 days (Haiku picks, or says
// "not sure"), apply the detail as an EDIT via the trusted correction path, and name the expense in
// the reply so a wrong pick is visible. Not sure -> ask once with a numbered list. Never drop it.
// Spec: claude_files/specs/late-context-matching.md.
const CONTEXT_LOOKBACK_DAYS = 30;
const CONTEXT_MAX_CANDIDATES = 10;

const NO_RECENT_EXPENSE_REPLY =
  'I don\'t see a recent expense to add that to. Text me the expense with the detail ' +
  '(like "$230 hotel, Austin conference") and I\'ll log both.';

async function applyContext(user: AppUser, r: ReceiptRow, text: string): Promise<ProcessResult | null> {
  const corrected = await processCorrection(user, r.id, text);
  if (corrected.receiptId === null) return null; // receipt vanished mid-flight
  return { ...corrected, smsText: withExpenseName(corrected.smsText, r) };
}

async function handleContextStatement(user: AppUser, text: string): Promise<ProcessResult> {
  const since = new Date(Date.now() - CONTEXT_LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();
  const rows = await listRecentReceiptsSince(user.organization_id, since, CONTEXT_MAX_CANDIDATES);

  if (rows.length === 1) {
    const applied = await applyContext(user, rows[0], text);
    if (applied) return applied;
  } else if (rows.length > 1) {
    const pick = await pickReceiptForContext(text, rows);
    const matched = pick.match ? rows.find((r) => r.id === pick.match) : undefined;
    if (matched) {
      const applied = await applyContext(user, matched, text);
      if (applied) return applied;
    }
    const shortlisted = rows.filter((r) => pick.shortlist.includes(r.id));
    const list = (shortlisted.length > 0 ? shortlisted : rows).slice(0, 5);
    return {
      smsText: contextChoiceMessage(list),
      receiptId: null,
      contextState: 'awaiting_context_choice',
      pendingData: { candidateIds: list.map((r) => r.id), contextText: text },
    };
  }

  // Nothing to attach it to. Say so honestly, and record that we DELIBERATELY did not log (Alex's
  // silent-non-logging guard: a classifier that wrongly diverts real expenses here stays auditable).
  log.info('conversational_no_log', { user: user.id, kind: 'context_statement', applied: false });
  return reply(NO_RECENT_EXPENSE_REPLY);
}

/** Resolve a "1/2/3" reply to a "which expense was that about?" prompt: apply the stored detail. */
export async function resolveContextChoice(
  user: AppUser,
  candidateIds: string[],
  contextText: string,
  choice: number,
): Promise<ProcessResult> {
  if (!Number.isInteger(choice) || choice < 1 || choice > candidateIds.length) {
    return {
      ...reply(`Reply with a number 1-${candidateIds.length}.`),
      contextState: 'awaiting_context_choice',
      pendingData: { candidateIds, contextText },
    };
  }
  const r = await getReceipt(user.organization_id, candidateIds[choice - 1]);
  if (!r) return reply("Hmm, that one's not there anymore.");
  return (await applyContext(user, r, contextText)) ?? reply("Hmm, that one's not there anymore.");
}

/** Which expense a turn-interpreter edit lands on: the validated id, else ask among the candidates
 *  (or the 5 newest). Pure. */
export function editTarget(d: TurnDecision, receipts: ReceiptRow[]): { apply: ReceiptRow } | { ask: ReceiptRow[] } | { none: true } {
  const hit = d.receiptId ? receipts.find((r) => r.id === d.receiptId) : undefined;
  if (hit) return { apply: hit };
  if (receipts.length === 0) return { none: true };
  const shortlisted = receipts.filter((r) => d.candidates.includes(r.id));
  return { ask: (shortlisted.length > 0 ? shortlisted : receipts).slice(0, 5) };
}

/**
 * Act on a turn-interpreter decision for the actions the router owns (questions, commands, edits).
 * Returns null for the ones sms-handler owns (new_expense, answer_open_question, explain_why) and for
 * a bulk receipt_resolution while a single receipt question is open (sms-handler takes that path).
 */
export async function routeDecision(user: AppUser, text: string, d: TurnDecision, ctx: TurnContext): Promise<ProcessResult | null> {
  switch (d.action) {
    case 'query':
      return d.query ? runQuery(user.organization_id, { kind: 'query', ...d.query }) : reply(HELP_TEXT);
    case 'command':
      return d.command ? commandReply(user, d.command) : reply(greetingReply(user, text));
    case 'advice':
      return reply(ADVICE_DEFLECTION);
    case 'help':
      return reply(greetingReply(user, text));
    case 'capability':
      return answerCapability(text);
    case 'other':
      log.info('conversational_no_log', { user: user.id, kind: 'other', applied: false });
      return reply(CANT_HELP_TEXT);
    case 'edit_expense': {
      const t = editTarget(d, ctx.receipts);
      if ('apply' in t) {
        const applied = await applyContext(user, t.apply, text);
        if (applied) return applied;
      } else if ('ask' in t) {
        return {
          smsText: contextChoiceMessage(t.ask),
          receiptId: null,
          contextState: 'awaiting_context_choice',
          pendingData: { candidateIds: t.ask.map((r) => r.id), contextText: text },
        };
      }
      log.info('conversational_no_log', { user: user.id, kind: 'context_statement', applied: false });
      return reply(NO_RECENT_EXPENSE_REPLY);
    }
    case 'receipt_resolution': {
      if (ctx.open.question?.contextState === 'awaiting_receipt') return null; // single-receipt path
      if (d.resolution === 'none') {
        const n = await waiveAllFlaggedReceipts(user.organization_id);
        if (n > 0) {
          log.info('receipts_waived_bulk', { user: user.id, count: n });
          return reply(bulkWaiveMessage(n));
        }
        return reply(greetingReply(user, text));
      }
      return ctx.flaggedCount > 0 ? reply(RECEIPT_LATER_ACK) : reply(greetingReply(user, text));
    }
    default:
      return null;
  }
}

/** Answer a "how does Tally work / can it do X" question from the grounded fact sheet. On any LLM
 *  failure, fall back to the succinct help text rather than dead-ending. */
async function answerCapability(text: string): Promise<ProcessResult> {
  try {
    const answer = await claudeText({
      model: HAIKU_MODEL,
      system: CAPABILITY_PROMPT,
      userText: text,
      cacheSystem: true,
      maxTokens: 1024,
    });
    const trimmed = answer.trim();
    return reply(trimmed || HELP_TEXT);
  } catch (err) {
    log.warn('router_capability_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return reply(HELP_TEXT);
  }
}

/**
 * Try to handle a text message conversationally. Returns a ProcessResult to send, or
 * null to let the caller run the normal expense-capture flow. Read-only except the
 * explicit "flag for CPA" marker and applying a context statement to a recent receipt.
 */
export async function routeTextMessage(user: AppUser, text: string): Promise<ProcessResult | null> {
  // Obvious expense → straight to capture, no classifier call.
  if (looksLikeExpenseCapture(text)) return null;

  // "Flag for my CPA" → target by amount/vendor, ask to pick if ambiguous (no classifier).
  if (FLAG_CPA_RE.test(text)) return flagForCpa(user, text);

  // "What's your name?" / "call you Max" → answer or rename, no classifier.
  const nameMsg = matchAgentNameMessage(text);
  if (nameMsg) return agentNameReply(user, nameMsg);

  // Reason WITH receipt context: a reply like "don't have it / skip these / I'll send it later" is
  // only meaningful given the user has outstanding flagged receipts (e.g. answering the weekly
  // reminder, which sets no live pending context). One cheap count feeds the existing classify call —
  // no extra LLM round trip. This replaces the per-phrasing regex matching for reminder replies.
  const flaggedCount = await countFlaggedReceipts(user.organization_id);
  const intent = await classifyIntent(text, { flaggedCount });
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
      return reply(greetingReply(user, text));
    case 'capability':
      return answerCapability(text);
    case 'context_statement':
      return handleContextStatement(user, text);
    case 'receipt_resolution': {
      if (intent.resolution === 'none') {
        const n = await waiveAllFlaggedReceipts(user.organization_id);
        if (n > 0) {
          log.info('receipts_waived_bulk', { user: user.id, count: n });
          return reply(bulkWaiveMessage(n));
        }
        return null; // nothing flagged to waive → let the capture path handle it
      }
      // "later" → keep flagged (the weekly nudge keeps trying), just acknowledge.
      return flaggedCount > 0 ? reply(RECEIPT_LATER_ACK) : null;
    }
    case 'other':
      // Off-topic → can't-help reply. Log-only metric so anything we declined to act on is auditable.
      log.info('conversational_no_log', { user: user.id, kind: 'other', applied: false });
      return reply(CANT_HELP_TEXT);
  }
}
