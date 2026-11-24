// Late context matching (spec: claude_files/specs/late-context-matching.md). A user adds a detail
// after the fact ("that hotel was for the conference"); find the expense they meant, or ask.

import { formatMoney, shortDate } from './format';
import { claudeJSON } from './llm';
import { HAIKU_MODEL } from './claude';
import { log } from './log';
import type { ReceiptRow } from './receipts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function age(createdAt: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  if (ms < HOUR) return `${Math.round(ms / MIN)} min ago`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} hours ago`;
  return `${Math.round(ms / DAY)} days ago`;
}

/** One candidate line for the picker prompt. */
export function formatCandidateLine(r: ReceiptRow, now: Date): string {
  return `${r.id} · ${r.vendor ?? 'Unknown'} · ${formatMoney(r.amount_cents)} · ${r.category ?? 'uncategorized'} · logged ${age(r.created_at, now)}`;
}

/** Keep only ids we actually offered. Anything malformed or foreign means "no match". */
export function validatePick(raw: unknown, candidateIds: string[]): { match: string | null; shortlist: string[] } {
  if (!raw || typeof raw !== 'object') return { match: null, shortlist: [] };
  const o = raw as { match?: unknown; shortlist?: unknown };
  const ok = (v: unknown): v is string => typeof v === 'string' && candidateIds.includes(v);
  const shortlist = Array.isArray(o.shortlist) ? o.shortlist.filter(ok) : [];
  return { match: ok(o.match) ? o.match : null, shortlist };
}

/** "Which expense was that about?" numbered list, max 5. Same line shape as the flag list. */
export function contextChoiceMessage(rows: ReceiptRow[]): string {
  const lines = rows
    .slice(0, 5)
    .map((r, i) => `${i + 1}) ${r.vendor ?? 'Unknown'} ${formatMoney(r.amount_cents)}${shortDate(r.transaction_date)}`);
  return `Which expense was that about?\n${lines.join('\n')}\nReply with a number.`;
}

/** Name the expense the detail landed on, so a wrong pick is visible. */
export function withExpenseName(reply: string, r: ReceiptRow): string {
  if (!r.vendor || reply.toLowerCase().includes(r.vendor.toLowerCase())) return reply;
  return `${r.vendor} ${formatMoney(r.amount_cents)}: ${reply}`;
}

const CONTEXT_PICK_PROMPT = `A user of an expense logger texted a detail about an expense they logged earlier. Decide which of their recent expenses (listed below, newest first) the message is about. Return ONLY JSON, no prose.

Return {"match": "<id>"} when exactly ONE expense plausibly fits the message.
Return {"match": null, "shortlist": ["<id>", ...]} when two or more could fit (list them), or none fits (empty shortlist).

Rules:
- Match on what the message names: vendor, type of expense (hotel, dinner, flight, gas), amount, place, or trip.
- The people, purpose, or reason in the message are the NEW detail being added, so they won't appear in the list. "Lunch with Jen was about the pitch" matches the one meal expense; don't require Jen to be listed.
- If two expenses could both fit (two hotels, two expenses from the same trip), return null with both in the shortlist. Never guess between them.
- A trip or place ("the Austin trip one", "the Denver one") fits EVERY expense from that trip: the hotel, the flight (airport codes like AUS count), rides and meals logged around the same days. If more than one is listed, return null with all of them.
- A bare reference with nothing else ("that one", "it", "that was personal") means the most recent expense ONLY if it was logged less than 2 hours ago. Otherwise return null.
- Only use ids from the list. Never invent one.`;

/** Ask Haiku which recent expense a late detail refers to. Any failure means "no match" (we ask). */
export async function pickReceiptForContext(
  text: string,
  rows: ReceiptRow[],
  now: Date = new Date(),
): Promise<{ match: string | null; shortlist: string[] }> {
  const ids = rows.map((r) => r.id);
  try {
    const raw = await claudeJSON<unknown>({
      model: HAIKU_MODEL,
      system: CONTEXT_PICK_PROMPT,
      userText: `Recent expenses:\n${rows.map((r) => formatCandidateLine(r, now)).join('\n')}\n\nMessage: ${text}`,
      cacheSystem: true,
      maxTokens: 1024,
    });
    return validatePick(raw, ids);
  } catch (err) {
    log.warn('context_pick_failed', { message: err instanceof Error ? err.message : 'unknown' });
    return { match: null, shortlist: [] };
  }
}
