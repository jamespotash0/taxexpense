// Read-only expense QUERY layer for the conversational SMS router + "review my year"
// (DEC-029). The contract: the LLM only classifies intent and extracts params; EVERY
// number returned to a user is computed here from the database, never by the model.
// Replies that contain a figure are built by the pure `format*` templates below.
//
// Everything here is READ-ONLY and org-scoped. No mutations live in this module.

import { orgTable } from './db';
import { formatMoney, shortDate } from './format';
import { categoryLabel, CATEGORY_LABELS } from './categories';
import { listReceipts } from './receipts';

// ---------------------------------------------------------------------------
// Periods (pure) — resolve a named window to YYYY-MM-DD bounds + a human label.
// ---------------------------------------------------------------------------

export type PeriodKey =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'all';

export const PERIOD_KEYS: PeriodKey[] = [
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
  'last_year',
  'all',
];

export interface ResolvedPeriod {
  /** Inclusive lower bound (YYYY-MM-DD), or null for "no lower bound" (all-time). */
  start: string | null;
  /** Inclusive upper bound (YYYY-MM-DD), or null. */
  end: string | null;
  /** Human label used verbatim in replies, e.g. "this month", "in 2025". */
  label: string;
}

function ymd(y: number, month0: number, day: number): string {
  return `${y}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function lastDayOfMonth(y: number, month0: number): number {
  return new Date(y, month0 + 1, 0).getDate();
}

export function isPeriodKey(v: string | undefined | null): v is PeriodKey {
  return !!v && (PERIOD_KEYS as string[]).includes(v);
}

/** Resolve a period relative to `now` (injectable for tests). Defaults to this month. */
export function resolvePeriod(key: PeriodKey | undefined, now: Date = new Date()): ResolvedPeriod {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  switch (key) {
    case 'last_month': {
      const ly = m === 0 ? y - 1 : y;
      const lm = m === 0 ? 11 : m - 1;
      return { start: ymd(ly, lm, 1), end: ymd(ly, lm, lastDayOfMonth(ly, lm)), label: 'last month' };
    }
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      const qEnd = qStart + 2;
      return { start: ymd(y, qStart, 1), end: ymd(y, qEnd, lastDayOfMonth(y, qEnd)), label: 'this quarter' };
    }
    case 'this_year':
      return { start: ymd(y, 0, 1), end: ymd(y, 11, 31), label: `in ${y}` };
    case 'last_year':
      return { start: ymd(y - 1, 0, 1), end: ymd(y - 1, 11, 31), label: `in ${y - 1}` };
    case 'all':
      return { start: null, end: null, label: 'all time' };
    case 'this_month':
    default:
      return { start: ymd(y, m, 1), end: ymd(y, m, lastDayOfMonth(y, m)), label: 'this month' };
  }
}

// ---------------------------------------------------------------------------
// Category normalization (pure) — map a free-text term to canonical keys.
// ---------------------------------------------------------------------------

/** User-facing aliases → canonical category keys (a term may span several keys). */
const CATEGORY_ALIASES: Record<string, string[]> = {
  meals: ['meals_business', 'meals_travel'],
  meal: ['meals_business', 'meals_travel'],
  food: ['meals_business', 'meals_travel'],
  dining: ['meals_business', 'meals_travel'],
  lunch: ['meals_business', 'meals_travel'],
  dinner: ['meals_business', 'meals_travel'],
  restaurant: ['meals_business', 'meals_travel'],
  travel: ['travel_transportation', 'travel_lodging', 'meals_travel'],
  flights: ['travel_transportation'],
  flight: ['travel_transportation'],
  airfare: ['travel_transportation'],
  hotel: ['travel_lodging'],
  hotels: ['travel_lodging'],
  lodging: ['travel_lodging'],
  gifts: ['business_gifts'],
  gift: ['business_gifts'],
  vehicle: ['vehicle_business'],
  car: ['vehicle_business'],
  mileage: ['vehicle_business'],
  gas: ['vehicle_business'],
  mileage_business: ['vehicle_business'],
  software: ['software'],
  subscriptions: ['software'],
  office: ['office_supplies'],
  supplies: ['office_supplies'],
  legal: ['professional_services'],
  professional: ['professional_services'],
  ads: ['advertising'],
  advertising: ['advertising'],
  marketing: ['advertising'],
  internet: ['internet_phone'],
  phone: ['internet_phone'],
  equipment: ['equipment'],
  insurance: ['insurance'],
  rent: ['rent'],
  repairs: ['repairs'],
  education: ['education'],
  training: ['education'],
  'home office': ['home_office'],
  home_office: ['home_office'],
  personal: ['personal'],
};

export interface NormalizedCategory {
  /** Canonical category keys this term maps to. */
  keys: string[];
  /** Display label, e.g. "Business Meals" or a grouped "meals". */
  label: string;
}

/**
 * Normalize a free-text category term to canonical keys. Returns null for an
 * unknown/empty term (caller treats null as "all categories"). Accepts both
 * canonical keys (e.g. "meals_business") and human aliases (e.g. "food").
 */
export function normalizeCategory(input: string | null | undefined): NormalizedCategory | null {
  if (!input) return null;
  const term = input.trim().toLowerCase();
  if (!term) return null;
  // Exact canonical key.
  if (CATEGORY_LABELS[term]) return { keys: [term], label: CATEGORY_LABELS[term] };
  // Alias group.
  const aliased = CATEGORY_ALIASES[term];
  if (aliased) {
    // Single-key alias → use its proper label; multi-key → the human term, capitalized.
    const label = aliased.length === 1 ? categoryLabel(aliased[0]) : term.replace(/^\w/, (c) => c.toUpperCase());
    return { keys: aliased, label };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deterministic aggregates (DB) — the source of every number a user sees.
// ---------------------------------------------------------------------------

type AmountRow = { amount_cents: number | null; deductible_amount_cents: number | null };

export interface AggregateResult {
  total_cents: number;
  deductible_cents: number;
  count: number;
  periodLabel: string;
  categoryLabel: string | null;
}

/** Sum amount + deductible + count over a period, optionally filtered to a category group. */
export async function aggregateExpenses(
  orgId: string,
  opts: { period?: PeriodKey; category?: string | null } = {},
): Promise<AggregateResult> {
  const { start, end, label } = resolvePeriod(opts.period);
  const cat = normalizeCategory(opts.category);

  let q = orgTable('receipts', orgId).select('amount_cents, deductible_amount_cents');
  if (start) q = q.gte('transaction_date', start);
  if (end) q = q.lte('transaction_date', end);
  if (cat) q = q.in('category', cat.keys);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data as unknown as AmountRow[]) ?? [];

  let total = 0;
  let deductible = 0;
  for (const r of rows) {
    total += r.amount_cents ?? 0;
    deductible += r.deductible_amount_cents ?? 0;
  }
  return {
    total_cents: total,
    deductible_cents: deductible,
    count: rows.length,
    periodLabel: label,
    categoryLabel: cat?.label ?? null,
  };
}

export interface CategoryTotal {
  category: string | null;
  label: string;
  total_cents: number;
  count: number;
}

/** Per-category totals for a period, highest spend first. */
export async function categoryBreakdown(
  orgId: string,
  period?: PeriodKey,
): Promise<{ rows: CategoryTotal[]; periodLabel: string }> {
  const { start, end, label } = resolvePeriod(period);
  let q = orgTable('receipts', orgId).select('amount_cents, category');
  if (start) q = q.gte('transaction_date', start);
  if (end) q = q.lte('transaction_date', end);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data as unknown as { amount_cents: number | null; category: string | null }[]) ?? [];

  const byCat = new Map<string | null, { total: number; count: number }>();
  for (const r of rows) {
    const cur = byCat.get(r.category) ?? { total: 0, count: 0 };
    cur.total += r.amount_cents ?? 0;
    cur.count += 1;
    byCat.set(r.category, cur);
  }
  const out: CategoryTotal[] = [...byCat.entries()]
    .map(([category, v]) => ({ category, label: categoryLabel(category), total_cents: v.total, count: v.count }))
    .sort((a, b) => b.total_cents - a.total_cents);
  return { rows: out, periodLabel: label };
}

export interface RecentExpense {
  vendor: string | null;
  amount_cents: number;
  category: string | null;
  transaction_date: string | null;
}

/** The most recent N expenses (newest first). Caps at 10. */
export async function recentExpenses(orgId: string, n = 3): Promise<RecentExpense[]> {
  const limit = Math.min(Math.max(n, 1), 10);
  const { rows } = await listReceipts(orgId, { limit });
  return rows.map((r) => ({
    vendor: r.vendor,
    amount_cents: r.amount_cents,
    category: r.category,
    transaction_date: r.transaction_date,
  }));
}

// ---------------------------------------------------------------------------
// Reply templates (pure) — numbers in, SMS string out. The ONLY place numeric
// answers are rendered, so every figure traces to a DB aggregate above.
// ---------------------------------------------------------------------------

/** "You've logged $X across N expenses [on <category>] <period> — $Y deductible." */
export function formatAggregate(r: AggregateResult): string {
  const scope = r.categoryLabel ? ` on ${r.categoryLabel}` : '';
  if (r.count === 0) {
    return `No expenses${scope} ${r.periodLabel} yet.`;
  }
  const noun = r.count === 1 ? 'expense' : 'expenses';
  return `You've logged ${formatMoney(r.total_cents)} across ${r.count} ${noun}${scope} ${r.periodLabel} (${formatMoney(
    r.deductible_cents,
  )} deductible).`;
}

/** "Your last N: • $54 Uber · Vehicle (Jun 1) • …" */
export function formatRecent(rows: RecentExpense[]): string {
  if (rows.length === 0) return "You haven't logged any expenses yet.";
  const lines = rows.map((r) => {
    const vendor = r.vendor ?? 'Unknown vendor';
    return `• ${formatMoney(r.amount_cents)} ${vendor} · ${categoryLabel(r.category)}${shortDate(r.transaction_date)}`;
  });
  return `Your last ${rows.length}:\n${lines.join('\n')}`;
}

/** "Top categories <period>: Meals $1,200 · Software $400 · Vehicle $180" (top 5). */
export function formatBreakdown(rows: CategoryTotal[], periodLabel: string, top = 5): string {
  if (rows.length === 0) return `No expenses ${periodLabel} yet.`;
  const parts = rows.slice(0, top).map((r) => `${r.label} ${formatMoney(r.total_cents)}`);
  return `Top spend ${periodLabel}: ${parts.join(' · ')}.`;
}
