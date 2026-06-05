// Year-End Tax Cleanup Mode (TSNAP-EPIC-9). Scans a tax year's receipts for
// issues to resolve BEFORE filing: missing receipts, missing context, likely
// duplicates, mixed personal/business spend, and vague memos.
//
// ARCHITECTURE (DEC-028): this is a WORKFLOW, not an agent. Four of the five
// checks are pure deterministic code reading fields we already store — fully
// unit-testable, no LLM. Only vague-memo detection calls Claude, as an OPTIONAL
// additive layer (scanReceipts works fully without it; see scanWithMemoReview).
//
// COPY RULE: we SUGGEST, never advise (CLAUDE.md #1). Issue messages point at a
// fixable gap; the user always resolves it on the receipt. We never auto-edit,
// and we say "documentation complete", never "audit-ready" (CLAUDE.md #5).

import type { ReceiptRow } from './receipts';
import { claudeJSON } from './llm';
import { HAIKU_MODEL } from './claude';
import { categoryLabel } from './categories';

/** Human-readable phrasing for the substantiation field keys, for user-facing SMS copy. */
const FIELD_LABELS: Record<string, string> = {
  attendees: 'who was there',
  business_purpose: 'the business purpose',
  business_relationship: 'your business relationship to them',
  location_city: 'the location',
  business_miles: 'the miles driven',
};

function humanizeFields(fields: string[]): string {
  const labeled = fields.map((f) => FIELD_LABELS[f] ?? f.replace(/_/g, ' '));
  if (labeled.length <= 1) return labeled.join('');
  return `${labeled.slice(0, -1).join(', ')} and ${labeled[labeled.length - 1]}`;
}

/** The kinds of issue the year-end scan can surface, in resolve-priority order. */
export type CleanupIssueType =
  | 'needs_receipt' // strict-category expense missing a required receipt photo
  | 'missing_context' // strict category missing required §274(d) context fields
  | 'duplicate' // same vendor + amount + near date — possible double-log
  | 'mixed_account' // business expense on a personal card, or a personal item logged
  | 'gift_cap' // gifts to one recipient exceed the $25/recipient/year deduction cap
  | 'vehicle_method' // both mileage AND actual vehicle costs (gas) logged — likely double-count
  | 'vague_memo'; // note/purpose present but too vague to substantiate

export interface CleanupIssue {
  type: CleanupIssueType;
  /** Receipt ids this issue concerns. Single id except for duplicate clusters. */
  receipt_ids: string[];
  /** Short, user-facing, suggestive (never imperative) description of the gap. */
  message: string;
  /** Optional machine detail for the UI (e.g. which fields are missing). */
  fields?: string[];
}

export interface CleanupReport {
  tax_year: number;
  scanned_count: number;
  issues: CleanupIssue[];
  /** Per-type counts, for the dashboard summary chips. */
  counts: Record<CleanupIssueType, number>;
}

/** Window (days) within which two same-vendor, same-amount receipts look like a dupe. */
const DUPLICATE_WINDOW_DAYS = 3;

/**
 * IRS business-gift deduction cap: $25 per recipient per year (IRC §274(b)(1)).
 * substantiation.ts applies this PER-RECEIPT; the cleanup scan catches the
 * per-recipient/year AGGREGATE that the per-receipt cap structurally can't.
 */
const GIFT_CAP_CENTS = 2500;

// ---------------------------------------------------------------------------
// Individual checks — each pure: ReceiptRow[] -> CleanupIssue[]
// ---------------------------------------------------------------------------

/** Strict-category expenses still flagged needs_receipt (over $75 no photo, lodging, gifts). */
export function checkNeedsReceipt(receipts: ReceiptRow[]): CleanupIssue[] {
  return receipts
    .filter((r) => r.needs_receipt)
    .map((r) => ({
      type: 'needs_receipt' as const,
      receipt_ids: [r.id],
      message:
        r.receipt_reason ??
        'This expense looks like it needs a receipt photo to be documentation complete.',
    }));
}

/**
 * Strict-category expenses missing required context fields (attendees, business
 * purpose, miles, …) — reuses the authoritative substantiation flags, so this
 * never re-derives tax logic. Skips rows already caught as needs_receipt.
 */
export function checkMissingContext(receipts: ReceiptRow[]): CleanupIssue[] {
  return receipts
    .filter((r) => !r.substantiation_complete && !r.needs_receipt)
    .filter((r) => (r.substantiation_missing_fields?.length ?? 0) > 0)
    .map((r) => ({
      type: 'missing_context' as const,
      receipt_ids: [r.id],
      fields: r.substantiation_missing_fields ?? [],
      message: `Missing ${humanizeFields(r.substantiation_missing_fields ?? [])} — the IRS asks for this on ${
        r.category ? categoryLabel(r.category).toLowerCase() : 'this category'
      }.`,
    }));
}

/**
 * Likely duplicates: same vendor (case-insensitive) + identical amount_cents +
 * transaction dates within DUPLICATE_WINDOW_DAYS. Each cluster becomes ONE issue
 * listing all member ids, so the user confirms-or-deletes once.
 */
export function checkDuplicates(receipts: ReceiptRow[]): CleanupIssue[] {
  // Group by vendor+amount; within each group, cluster by date proximity.
  const groups = new Map<string, ReceiptRow[]>();
  for (const r of receipts) {
    if (!r.vendor || r.amount_cents == null) continue;
    const key = `${r.vendor.trim().toLowerCase()}|${r.amount_cents}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const issues: CleanupIssue[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Sort by date so adjacent rows are the closest in time.
    const sorted = [...group].sort((a, b) => dateNum(a) - dateNum(b));
    let cluster: ReceiptRow[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const within = dateNum(sorted[i]) - dateNum(sorted[i - 1]) <= DUPLICATE_WINDOW_DAYS * DAY_MS;
      if (within) {
        cluster.push(sorted[i]);
      } else {
        if (cluster.length >= 2) issues.push(duplicateIssue(cluster));
        cluster = [sorted[i]];
      }
    }
    if (cluster.length >= 2) issues.push(duplicateIssue(cluster));
  }
  return issues;
}

function duplicateIssue(cluster: ReceiptRow[]): CleanupIssue {
  const r = cluster[0];
  return {
    type: 'duplicate',
    receipt_ids: cluster.map((x) => x.id),
    message: `${cluster.length} expenses at ${r.vendor} for the same amount within a few days — possible duplicate?`,
  };
}

/**
 * Mixed personal/business: (a) a deductible business expense paid from a personal
 * account — fine to deduct, but worth confirming the business purpose; and
 * (b) an expense logged under the non-deductible `personal` (§262) category that
 * is sitting in the books. Both are surfaced as gentle confirmations.
 */
export function checkMixedAccount(receipts: ReceiptRow[]): CleanupIssue[] {
  const issues: CleanupIssue[] = [];
  for (const r of receipts) {
    if (r.category === 'personal') {
      issues.push({
        type: 'mixed_account',
        receipt_ids: [r.id],
        message: `Logged as personal — it won't be deducted. Re-categorize if it was actually for business.`,
      });
    } else if (r.payment_account === 'personal' && (r.deductible_amount_cents ?? 0) > 0) {
      issues.push({
        type: 'mixed_account',
        receipt_ids: [r.id],
        message: `Business expense paid from a personal account — confirm the business purpose so it's clearly substantiated.`,
      });
    }
  }
  return issues;
}

/**
 * Gift-cap overage: business_gifts grouped by recipient (the `attendees` field,
 * exact-match per TSNAP-030) whose TOTAL spend for the year exceeds $25 — the
 * cumulative direct+indirect $25/recipient/year limit (IRC §274(b)(1)). This is the
 * aggregate the per-receipt cap in substantiation.ts structurally can't catch. One
 * issue per over-cap recipient, listing every gift receipt to that recipient. Gifts
 * with no named recipient are skipped (already surfaced as missing_context).
 *
 * KNOWN CARVE-OUTS WE CANNOT DETECT from {amount, date, recipient}, so we SUGGEST
 * (review this), never assert "not deductible" (CLAUDE.md #1):
 *   - $4 de-minimis: imprinted items ≤$4 distributed generally are exempt from the cap.
 *   - Promotional materials (signs, display racks) for the recipient's premises aren't gifts.
 *   - Spouses count as one recipient; we group by the exact name supplied, so two names
 *     for a couple won't merge.
 *   - Partnerships apply the cap at the entity AND partner level — out of V1 scope
 *     (target is sole props / SMLLCs). See claude_files/docs/CPA-REVIEW-CLEANUP.md.
 */
export function checkGiftCapByRecipient(receipts: ReceiptRow[]): CleanupIssue[] {
  const byRecipient = new Map<string, ReceiptRow[]>();
  for (const r of receipts) {
    if (r.category !== 'business_gifts') continue;
    const recipient = r.attendees?.trim();
    if (!recipient) continue; // no name to group on — missing_context owns this
    const key = recipient.toLowerCase();
    const g = byRecipient.get(key);
    if (g) g.push(r);
    else byRecipient.set(key, [r]);
  }

  const issues: CleanupIssue[] = [];
  for (const group of byRecipient.values()) {
    const totalSpend = group.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
    if (totalSpend <= GIFT_CAP_CENTS) continue;
    const name = group[0].attendees?.trim() ?? 'this recipient';
    const dollars = (totalSpend / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    issues.push({
      type: 'gift_cap',
      receipt_ids: group.map((r) => r.id),
      message: `$${dollars} in gifts to ${name} this year — the business-gift deduction is generally capped at $25 per recipient, so some of this may not count. (Imprinted items under $4 and promotional materials can be exempt — worth a quick check.)`,
    });
  }
  return issues;
}

/**
 * Vehicle method mixing: you generally can't deduct BOTH the standard mileage rate AND actual
 * vehicle costs (gas, etc.) for the same car in a year — the per-mile rate already bundles gas
 * in. If vehicle_business has BOTH mileage entries (business_miles set) AND cost entries (a
 * dollar amount with no miles), flag one issue. Suggest-don't-advise — the method election is
 * the user's / their CPA's call; we just surface the likely double-count.
 */
export function checkVehicleMethod(receipts: ReceiptRow[]): CleanupIssue[] {
  const vehicle = receipts.filter((r) => r.category === 'vehicle_business');
  const mileage = vehicle.filter((r) => r.business_miles != null);
  const costs = vehicle.filter((r) => r.business_miles == null && (r.amount_cents ?? 0) > 0);
  if (mileage.length === 0 || costs.length === 0) return [];
  return [
    {
      type: 'vehicle_method',
      receipt_ids: [...mileage, ...costs].map((r) => r.id),
      message:
        'You logged both mileage and actual vehicle costs (like gas). The standard mileage rate already includes gas, so you generally pick one method per car for the year — not both. Worth confirming which one with your CPA.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Orchestrator (deterministic only)
// ---------------------------------------------------------------------------

const ISSUE_ORDER: CleanupIssueType[] = [
  'needs_receipt',
  'missing_context',
  'gift_cap',
  'duplicate',
  'mixed_account',
  'vehicle_method',
  'vague_memo',
];

function emptyCounts(): Record<CleanupIssueType, number> {
  return { needs_receipt: 0, missing_context: 0, gift_cap: 0, duplicate: 0, mixed_account: 0, vehicle_method: 0, vague_memo: 0 };
}

/** Sort issues by resolve-priority, then tally per-type counts. */
function assemble(taxYear: number, scanned: number, issues: CleanupIssue[]): CleanupReport {
  const ordered = [...issues].sort(
    (a, b) => ISSUE_ORDER.indexOf(a.type) - ISSUE_ORDER.indexOf(b.type),
  );
  const counts = emptyCounts();
  for (const i of ordered) counts[i.type] += 1;
  return { tax_year: taxYear, scanned_count: scanned, issues: ordered, counts };
}

/**
 * Run every DETERMINISTIC check over a tax year's receipts. Pure — no I/O, no LLM.
 * This is the backbone; vague_memo is layered on separately by scanWithMemoReview.
 */
export function scanReceipts(receipts: ReceiptRow[], taxYear: number): CleanupReport {
  const issues = [
    ...checkNeedsReceipt(receipts),
    ...checkMissingContext(receipts),
    ...checkGiftCapByRecipient(receipts),
    ...checkDuplicates(receipts),
    ...checkMixedAccount(receipts),
    ...checkVehicleMethod(receipts),
  ];
  return assemble(taxYear, receipts.length, issues);
}

/** Merge an extra batch of (e.g. vague_memo) issues into an existing report. */
export function mergeIssues(report: CleanupReport, extra: CleanupIssue[]): CleanupReport {
  return assemble(report.tax_year, report.scanned_count, [...report.issues, ...extra]);
}

// ---------------------------------------------------------------------------
// Vague-memo review — the ONE check that needs Claude (optional layer)
// ---------------------------------------------------------------------------

const VAGUE_MEMO_PROMPT = `You review business expense memos for whether they explain the BUSINESS PURPOSE clearly enough to substantiate a deduction. A memo is "vague" if a stranger reading it could not tell why the expense was for business — e.g. "misc", "stuff", "supplies", "lunch", "work", or a bare amount. A memo is "clear" if it names a client, project, trip, or concrete purpose — e.g. "lunch w/ Acme re Q3 redesign", "Uber to client site".

You SUGGEST, never advise. Do not invent facts. Return ONLY JSON:
{"results":[{"id":"<receipt id>","vague":true|false,"suggestion":"<short, friendly nudge for what to add, or empty if clear>"}]}`;

/** A receipt is a candidate for memo review only if it HAS a memo/purpose to judge. */
function memoText(r: ReceiptRow): string | null {
  const memo = (r.business_purpose ?? r.notes ?? '').trim();
  return memo.length > 0 ? memo : null;
}

interface MemoVerdict {
  id: string;
  vague: boolean;
  suggestion?: string;
}

/**
 * LLM pass (Haiku) over receipts that HAVE a memo, flagging vague ones. Returns
 * vague_memo issues. Pure-fails safe: on any LLM/parse error returns [] so the
 * deterministic report still stands. Empty input → no call.
 */
export async function reviewVagueMemos(receipts: ReceiptRow[]): Promise<CleanupIssue[]> {
  const candidates = receipts
    .map((r) => ({ r, memo: memoText(r) }))
    .filter((x): x is { r: ReceiptRow; memo: string } => x.memo !== null);
  if (candidates.length === 0) return [];

  const userText = JSON.stringify(
    candidates.map(({ r, memo }) => ({ id: r.id, category: r.category, memo })),
  );

  try {
    const out = await claudeJSON<{ results?: MemoVerdict[] }>({
      model: HAIKU_MODEL,
      system: VAGUE_MEMO_PROMPT,
      userText,
      cacheSystem: true,
      maxTokens: 1024,
    });
    const byId = new Map(candidates.map(({ r }) => [r.id, r]));
    return (out.results ?? [])
      .filter((v) => v.vague && byId.has(v.id))
      .map((v) => ({
        type: 'vague_memo' as const,
        receipt_ids: [v.id],
        message: v.suggestion?.trim()
          ? v.suggestion.trim()
          : 'This memo is a bit vague — adding who/what it was for makes it clearly substantiated.',
      }));
  } catch {
    return [];
  }
}

/**
 * Full scan: deterministic checks + the vague-memo LLM layer, merged into one
 * report. Use this from the API route; use scanReceipts() where no LLM is wanted.
 */
export async function scanWithMemoReview(
  receipts: ReceiptRow[],
  taxYear: number,
): Promise<CleanupReport> {
  const base = scanReceipts(receipts, taxYear);
  const memoIssues = await reviewVagueMemos(receipts);
  return mergeIssues(base, memoIssues);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** transaction_date (YYYY-MM-DD) as epoch ms; missing dates sort to 0. */
function dateNum(r: ReceiptRow): number {
  if (!r.transaction_date) return 0;
  const t = Date.parse(`${r.transaction_date}T00:00:00Z`);
  return Number.isNaN(t) ? 0 : t;
}
