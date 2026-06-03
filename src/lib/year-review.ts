// "Review my year" (DEC-029) — a read-only annual summary for SMS / a year-end nudge.
// Reuses the deterministic year-end cleanup scan (lib/cleanup.ts) for the gap counts and
// computes all totals in code from the year's receipts. No model touches the numbers; the
// vague-memo LLM layer is intentionally skipped here (instant + cheap for SMS) — the
// dashboard's deep scan covers it. This is a SUMMARY, not the "what's missing" scanner.

import { getReceiptsForYear, type ReceiptRow } from './receipts';
import { scanReceipts, type CleanupIssueType } from './cleanup';
import { categoryLabel } from './categories';
import { formatMoney } from './format';

export interface YearReviewCategory {
  label: string;
  total_cents: number;
  count: number;
}

export interface YearReview {
  year: number;
  total_cents: number;
  deductible_cents: number;
  count: number;
  topCategories: YearReviewCategory[];
  /** Total open gaps to tidy before filing. */
  issueCount: number;
  counts: Record<CleanupIssueType, number>;
}

/**
 * Which tax year a bare "review my year" should default to. During filing season
 * (Jan 1 – Apr 15) people are closing out the PRIOR year; otherwise the current one.
 * Pure + injectable for tests.
 */
export function defaultReviewYear(now: Date = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const beforeApr15 = m < 3 || (m === 3 && now.getDate() <= 15);
  return beforeApr15 ? y - 1 : y;
}

/** Sum totals + top categories from already-fetched rows (pure; no DB). */
function summarize(receipts: ReceiptRow[]): {
  total_cents: number;
  deductible_cents: number;
  topCategories: YearReviewCategory[];
} {
  let total = 0;
  let deductible = 0;
  const byCat = new Map<string | null, { total: number; count: number }>();
  for (const r of receipts) {
    total += r.amount_cents ?? 0;
    deductible += r.deductible_amount_cents ?? 0;
    const cur = byCat.get(r.category) ?? { total: 0, count: 0 };
    cur.total += r.amount_cents ?? 0;
    cur.count += 1;
    byCat.set(r.category, cur);
  }
  const topCategories = [...byCat.entries()]
    .map(([category, v]) => ({ label: categoryLabel(category), total_cents: v.total, count: v.count }))
    .sort((a, b) => b.total_cents - a.total_cents)
    .slice(0, 3);
  return { total_cents: total, deductible_cents: deductible, topCategories };
}

/** Build a year review (one DB read + deterministic scan). Org-scoped, read-only. */
export async function reviewYear(orgId: string, year: number): Promise<YearReview> {
  const receipts = await getReceiptsForYear(orgId, year);
  const report = scanReceipts(receipts, year); // deterministic checks only (no LLM)
  const { total_cents, deductible_cents, topCategories } = summarize(receipts);
  return {
    year,
    total_cents,
    deductible_cents,
    count: receipts.length,
    topCategories,
    issueCount: report.issues.length,
    counts: report.counts,
  };
}

/** Human phrases for each gap type, used in the "things to tidy" line. */
const ISSUE_NOUN: Record<CleanupIssueType, [one: string, many: string]> = {
  needs_receipt: ['missing receipt', 'missing receipts'],
  missing_context: ['missing context', 'missing context'],
  gift_cap: ['gift over the $25 cap', 'gifts over the $25 cap'],
  duplicate: ['possible duplicate', 'possible duplicates'],
  mixed_account: ['to confirm', 'to confirm'],
  vehicle_method: ['vehicle method to confirm', 'vehicle method to confirm'],
  vague_memo: ['vague memo', 'vague memos'],
};

function issuePhrases(counts: Record<CleanupIssueType, number>): string[] {
  return (Object.keys(counts) as CleanupIssueType[])
    .filter((t) => counts[t] > 0)
    .map((t) => {
      const [one, many] = ISSUE_NOUN[t];
      return `${counts[t]} ${counts[t] === 1 ? one : many}`;
    });
}

/**
 * Render the review as one SMS. Numbers come straight from the struct (numbers-from-DB
 * contract). `cleanupUrl` deep-links to the dashboard to resolve any gaps.
 */
export function formatYearReview(review: YearReview, cleanupUrl: string): string {
  if (review.count === 0) {
    return `No ${review.year} expenses logged yet — text me one and I'll start your year.`;
  }

  const headline = `Your ${review.year}: ${formatMoney(review.total_cents)} across ${review.count} ${
    review.count === 1 ? 'expense' : 'expenses'
  }, ${formatMoney(review.deductible_cents)} deductible.`;

  const top = review.topCategories.length
    ? `\nTop: ${review.topCategories.map((c) => `${c.label} ${formatMoney(c.total_cents)}`).join(' · ')}.`
    : '';

  if (review.issueCount === 0) {
    return `${headline}${top}\nLooks documentation complete ✓ — nothing to tidy before you file.`;
  }

  const phrases = issuePhrases(review.counts);
  const tidy = `\n${review.issueCount} to tidy before you file: ${phrases.join(', ')}. Fix them here: ${cleanupUrl}`;
  return `${headline}${top}${tidy}`;
}
