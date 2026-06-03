// Unit tests for "review my year" pure logic (DEC-029): default-year selection
// and the SMS summary template. Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultReviewYear, formatYearReview, type YearReview } from './year-review';

const URL = 'https://tally.app/dashboard/cleanup';

function review(over: Partial<YearReview> = {}): YearReview {
  return {
    year: 2026,
    total_cents: 1234000,
    deductible_cents: 710000,
    count: 84,
    topCategories: [
      { label: 'Business Meals', total_cents: 320000, count: 18 },
      { label: 'Software', total_cents: 240000, count: 12 },
    ],
    issueCount: 0,
    counts: { needs_receipt: 0, missing_context: 0, duplicate: 0, mixed_account: 0, vague_memo: 0 },
    ...over,
  };
}

test('defaultReviewYear: filing season (before Apr 15) → prior year', () => {
  assert.equal(defaultReviewYear(new Date(2026, 1, 10)), 2025); // Feb
  assert.equal(defaultReviewYear(new Date(2026, 3, 15)), 2025); // Apr 15 (boundary, inclusive)
});

test('defaultReviewYear: after Apr 15 → current year', () => {
  assert.equal(defaultReviewYear(new Date(2026, 3, 16)), 2026); // Apr 16
  assert.equal(defaultReviewYear(new Date(2026, 5, 2)), 2026); // Jun
});

test('formatYearReview: clean year ends with documentation-complete', () => {
  const out = formatYearReview(review(), URL);
  assert.match(out, /Your 2026: \$12,340\.00 across 84 expenses, \$7,100\.00 deductible\./);
  assert.match(out, /Top: Business Meals \$3,200\.00 · Software \$2,400\.00\./);
  assert.match(out, /documentation complete ✓/);
  assert.ok(!out.includes(URL)); // no cleanup link when nothing to fix
});

test('formatYearReview: gaps list pluralized phrases + cleanup link', () => {
  const out = formatYearReview(
    review({
      issueCount: 3,
      counts: { needs_receipt: 2, missing_context: 1, duplicate: 0, mixed_account: 0, vague_memo: 0 },
    }),
    URL,
  );
  assert.match(out, /3 to tidy before you file: 2 missing receipts, 1 missing context\./);
  assert.ok(out.includes(URL));
});

test('formatYearReview: singular gap noun', () => {
  const out = formatYearReview(
    review({
      issueCount: 1,
      counts: { needs_receipt: 1, missing_context: 0, duplicate: 0, mixed_account: 0, vague_memo: 0 },
    }),
    URL,
  );
  assert.match(out, /1 to tidy before you file: 1 missing receipt\./);
});

test('formatYearReview: empty year invites a first expense', () => {
  const out = formatYearReview(review({ count: 0, total_cents: 0, deductible_cents: 0, topCategories: [] }), URL);
  assert.match(out, /No 2026 expenses logged yet/);
});
