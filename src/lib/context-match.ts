// Late context matching (spec: claude_files/specs/late-context-matching.md). A user adds a detail
// after the fact ("that hotel was for the conference"); find the expense they meant, or ask.

import { formatMoney, shortDate } from './format';
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
