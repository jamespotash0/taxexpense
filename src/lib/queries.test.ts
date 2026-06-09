// Unit tests for the read-only query layer (DEC-029) — pure pieces only:
// period resolution, category normalization, and the numeric reply templates.
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePeriod,
  isPeriodKey,
  normalizeCategory,
  formatAggregate,
  formatRecent,
  formatBreakdown,
  type AggregateResult,
} from './queries';

// Fixed "now" so period math is deterministic: 2026-06-02 (a Tuesday in Q2).
const NOW = new Date(2026, 5, 2); // month is 0-based → June

test('resolvePeriod: this_month bounds + label', () => {
  const p = resolvePeriod('this_month', NOW);
  assert.equal(p.start, '2026-06-01');
  assert.equal(p.end, '2026-06-30');
  assert.equal(p.label, 'this month');
});

test('resolvePeriod: last_month crosses correctly', () => {
  const p = resolvePeriod('last_month', NOW);
  assert.equal(p.start, '2026-05-01');
  assert.equal(p.end, '2026-05-31');
});

test('resolvePeriod: last_month rolls into prior year in January', () => {
  const p = resolvePeriod('last_month', new Date(2026, 0, 15));
  assert.equal(p.start, '2025-12-01');
  assert.equal(p.end, '2025-12-31');
});

test('resolvePeriod: this_quarter (Q2) = Apr–Jun', () => {
  const p = resolvePeriod('this_quarter', NOW);
  assert.equal(p.start, '2026-04-01');
  assert.equal(p.end, '2026-06-30');
});

test('resolvePeriod: this_year / last_year labels', () => {
  assert.equal(resolvePeriod('this_year', NOW).label, 'in 2026');
  assert.equal(resolvePeriod('last_year', NOW).label, 'in 2025');
  assert.equal(resolvePeriod('last_year', NOW).start, '2025-01-01');
});

test('resolvePeriod: all = no bounds', () => {
  const p = resolvePeriod('all', NOW);
  assert.equal(p.start, null);
  assert.equal(p.end, null);
  assert.equal(p.label, 'all time');
});

test('resolvePeriod: undefined defaults to this_month', () => {
  assert.equal(resolvePeriod(undefined, NOW).label, 'this month');
});

test('isPeriodKey guards', () => {
  assert.equal(isPeriodKey('this_year'), true);
  assert.equal(isPeriodKey('forever'), false);
  assert.equal(isPeriodKey(null), false);
});

test('normalizeCategory: canonical key passes through', () => {
  const n = normalizeCategory('meals_business');
  assert.deepEqual(n, { keys: ['meals_business'], label: 'Business Meals' });
});

test('normalizeCategory: alias group spans multiple keys', () => {
  const n = normalizeCategory('meals');
  assert.deepEqual(n?.keys, ['meals_business', 'meals_travel']);
});

test('normalizeCategory: single-key alias uses proper label', () => {
  const n = normalizeCategory('gas');
  assert.deepEqual(n, { keys: ['vehicle_business'], label: 'Vehicle / Mileage' });
});

test('normalizeCategory: unknown/empty → null (means all categories)', () => {
  assert.equal(normalizeCategory('quantum widgets'), null);
  assert.equal(normalizeCategory(''), null);
  assert.equal(normalizeCategory(null), null);
});

test('formatAggregate: numbers come straight from the struct', () => {
  const r: AggregateResult = {
    total_cents: 341822,
    deductible_cents: 170911,
    count: 22,
    periodLabel: 'this quarter',
    categoryLabel: 'Business Meals',
  };
  assert.equal(
    formatAggregate(r),
    "You've logged $3,418.22 across 22 expenses on Business Meals this quarter ($1,709.11 deductible).",
  );
});

test('formatAggregate: zero count is graceful', () => {
  const r: AggregateResult = { total_cents: 0, deductible_cents: 0, count: 0, periodLabel: 'this month', categoryLabel: null };
  assert.equal(formatAggregate(r), 'No expenses this month yet.');
});

test('formatAggregate: singular noun + no category scope', () => {
  const r: AggregateResult = { total_cents: 4900, deductible_cents: 4900, count: 1, periodLabel: 'in 2026', categoryLabel: null };
  assert.equal(formatAggregate(r), "You've logged $49.00 across 1 expense in 2026 ($49.00 deductible).");
});

test('formatRecent: lists vendor, category, amount', () => {
  const out = formatRecent([
    { vendor: 'Uber', amount_cents: 5400, category: 'vehicle_business', transaction_date: '2026-06-01' },
    { vendor: null, amount_cents: 4900, category: 'software', transaction_date: null },
  ]);
  assert.match(out, /Your last 2:/);
  assert.match(out, /\$54\.00 Uber · Vehicle \/ Mileage \(Jun 1\)/);
  assert.match(out, /\$49\.00 Unknown vendor · Software/);
});

test('formatRecent: empty', () => {
  assert.equal(formatRecent([]), "You haven't logged any expenses yet.");
});

test('formatBreakdown: top spend, highest first', () => {
  const out = formatBreakdown(
    [
      { category: 'meals_business', label: 'Business Meals', total_cents: 120000, count: 8 },
      { category: 'software', label: 'Software', total_cents: 40000, count: 3 },
    ],
    'this year',
  );
  assert.equal(out, 'Top spend this year: Business Meals $1,200.00 · Software $400.00.');
});
