// Unit tests for the year-end cleanup scan (TSNAP-EPIC-9, deterministic checks).
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanReceipts,
  mergeIssues,
  checkNeedsReceipt,
  checkMissingContext,
  checkDuplicates,
  checkMixedAccount,
  checkGiftCapByRecipient,
  checkVehicleMethod,
  reviewVagueMemos,
  type CleanupIssue,
} from './cleanup';
import type { ReceiptRow } from './receipts';

/** Build a ReceiptRow with sane defaults; override only the fields a test cares about. */
function row(over: Partial<ReceiptRow> = {}): ReceiptRow {
  return {
    id: over.id ?? 'r1',
    organization_id: 'org1',
    user_id: 'u1',
    vendor: 'Acme',
    amount_cents: 5000,
    transaction_date: '2026-03-10',
    payment_account: 'business',
    category: 'software',
    irc_section: '162',
    deduction_percentage: 100,
    deductible_amount_cents: 5000,
    business_purpose: null,
    attendees: null,
    business_relationship: null,
    location_city: null,
    business_miles: null,
    photo_url: null,
    needs_receipt: false,
    receipt_reason: null,
    receipt_waived_at: null,
    receipt_reminder_count: 0,
    substantiation_complete: true,
    substantiation_missing_fields: null,
    raw_extracted_data: null,
    notes: null,
    flagged_for_cpa: false,
    needs_review: false,
    review_reason: null,
    category_confidence: null,
    created_at: '2026-03-10T00:00:00Z',
    ...over,
  };
}

test('vehicle_method: flags mixing mileage + actual gas costs (same car/year)', () => {
  const issues = checkVehicleMethod([
    row({ id: 'm', category: 'vehicle_business', business_miles: 40, amount_cents: 2900 }),
    row({ id: 'g', category: 'vehicle_business', business_miles: null, amount_cents: 1500 }), // gas
    row({ id: 's', category: 'software' }), // ignored
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'vehicle_method');
  assert.deepEqual(new Set(issues[0].receipt_ids), new Set(['m', 'g']));
  assert.match(issues[0].message, /CPA/);
});

test('vehicle_method: no flag when only one method is used', () => {
  assert.equal(checkVehicleMethod([row({ category: 'vehicle_business', business_miles: 40 })]).length, 0);
  assert.equal(
    checkVehicleMethod([row({ category: 'vehicle_business', business_miles: null, amount_cents: 1500 })]).length,
    0,
  );
});

test('needs_receipt: flags rows awaiting a receipt and uses their reason', () => {
  const issues = checkNeedsReceipt([
    row({ id: 'a', needs_receipt: true, receipt_reason: 'Over $75 so the IRS asks for a receipt.' }),
    row({ id: 'b', needs_receipt: false }),
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].receipt_ids[0], 'a');
  assert.match(issues[0].message, /receipt/i);
});

test('missing_context: flags incomplete strict rows but not needs_receipt rows', () => {
  const issues = checkMissingContext([
    row({
      id: 'meal',
      category: 'meals_business',
      substantiation_complete: false,
      substantiation_missing_fields: ['attendees', 'business_purpose'],
    }),
    // already covered by needs_receipt — must NOT double-report here
    row({ id: 'dup', substantiation_complete: false, needs_receipt: true, substantiation_missing_fields: ['business_purpose'] }),
    // complete row — ignored
    row({ id: 'ok', substantiation_complete: true }),
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].receipt_ids[0], 'meal');
  assert.deepEqual(issues[0].fields, ['attendees', 'business_purpose']);
});

test('duplicates: clusters same vendor+amount within the date window', () => {
  const issues = checkDuplicates([
    row({ id: 'a', vendor: 'Uber', amount_cents: 2300, transaction_date: '2026-05-01' }),
    row({ id: 'b', vendor: 'uber', amount_cents: 2300, transaction_date: '2026-05-02' }), // case-insensitive, 1 day apart
    row({ id: 'c', vendor: 'Uber', amount_cents: 2300, transaction_date: '2026-09-01' }), // far away — separate
  ]);
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].receipt_ids.sort(), ['a', 'b']);
});

test('duplicates: different amounts at same vendor are not duplicates', () => {
  const issues = checkDuplicates([
    row({ id: 'a', vendor: 'Amazon', amount_cents: 1000 }),
    row({ id: 'b', vendor: 'Amazon', amount_cents: 2000 }),
  ]);
  assert.equal(issues.length, 0);
});

test('mixed_account: personal category and business-on-personal-card both flagged', () => {
  const issues = checkMixedAccount([
    row({ id: 'p', category: 'personal', deductible_amount_cents: 0 }),
    row({ id: 'biz', category: 'software', payment_account: 'personal', deductible_amount_cents: 5000 }),
    row({ id: 'clean', category: 'software', payment_account: 'business' }),
  ]);
  assert.equal(issues.length, 2);
  assert.deepEqual(issues.map((i) => i.receipt_ids[0]).sort(), ['biz', 'p']);
});

test('scanReceipts: assembles ordered issues with per-type counts', () => {
  const report = scanReceipts(
    [
      row({ id: 'a', needs_receipt: true, receipt_reason: 'needs it' }),
      row({ id: 'p', category: 'personal', deductible_amount_cents: 0 }),
    ],
    2026,
  );
  assert.equal(report.tax_year, 2026);
  assert.equal(report.scanned_count, 2);
  assert.equal(report.counts.needs_receipt, 1);
  assert.equal(report.counts.mixed_account, 1);
  // needs_receipt sorts before mixed_account
  assert.equal(report.issues[0].type, 'needs_receipt');
});

test('scanReceipts: clean books produce no issues', () => {
  const report = scanReceipts([row({ id: 'ok' })], 2026);
  assert.equal(report.issues.length, 0);
});

const gift = (over: Partial<ReceiptRow>): ReceiptRow =>
  row({ category: 'business_gifts', irc_section: '274', ...over });

test('gift_cap: aggregate spend to one recipient over $25 is flagged with all ids', () => {
  // Two $20 gifts each pass the per-receipt cap, but $40 to one person busts the $25/yr cap.
  const issues = checkGiftCapByRecipient([
    gift({ id: 'g1', attendees: 'Dana Lee', amount_cents: 2000 }),
    gift({ id: 'g2', attendees: 'dana lee', amount_cents: 2000 }), // case-insensitive match
  ]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'gift_cap');
  assert.deepEqual(issues[0].receipt_ids.sort(), ['g1', 'g2']);
  assert.match(issues[0].message, /Dana Lee/);
  assert.match(issues[0].message, /\$25/);
});

test('gift_cap: spend at or under $25 per recipient is not flagged', () => {
  const issues = checkGiftCapByRecipient([
    gift({ id: 'a', attendees: 'Sam', amount_cents: 2500 }), // exactly $25 — OK
    gift({ id: 'b', attendees: 'Pat', amount_cents: 1000 }),
  ]);
  assert.equal(issues.length, 0);
});

test('gift_cap: separate recipients each under cap are not flagged', () => {
  const issues = checkGiftCapByRecipient([
    gift({ id: 'a', attendees: 'Sam', amount_cents: 2000 }),
    gift({ id: 'b', attendees: 'Pat', amount_cents: 2000 }),
  ]);
  assert.equal(issues.length, 0);
});

test('gift_cap: gifts without a named recipient are skipped (missing_context owns those)', () => {
  const issues = checkGiftCapByRecipient([
    gift({ id: 'a', attendees: null, amount_cents: 9000 }),
    gift({ id: 'b', attendees: '   ', amount_cents: 9000 }),
  ]);
  assert.equal(issues.length, 0);
});

test('gift_cap: only business_gifts category is considered', () => {
  const issues = checkGiftCapByRecipient([
    row({ id: 'meal', category: 'meals_business', attendees: 'Dana', amount_cents: 9000 }),
  ]);
  assert.equal(issues.length, 0);
});

test('reviewVagueMemos: no receipts with a memo → returns [] without calling the LLM', async () => {
  // None of these have business_purpose or notes, so there are no candidates and
  // no Claude call is made (getClaude is lazy — this runs with no API key).
  const issues = await reviewVagueMemos([
    row({ id: 'a', business_purpose: null, notes: null }),
    row({ id: 'b', business_purpose: '   ', notes: '' }),
  ]);
  assert.deepEqual(issues, []);
});

test('mergeIssues: folds extra issues in and re-tallies counts in priority order', () => {
  const base = scanReceipts([row({ id: 'a', needs_receipt: true, receipt_reason: 'x' })], 2026);
  const extra: CleanupIssue[] = [
    { type: 'vague_memo', receipt_ids: ['v'], message: 'vague' },
  ];
  const merged = mergeIssues(base, extra);
  assert.equal(merged.counts.needs_receipt, 1);
  assert.equal(merged.counts.vague_memo, 1);
  // needs_receipt sorts before vague_memo
  assert.equal(merged.issues[0].type, 'needs_receipt');
  assert.equal(merged.issues[merged.issues.length - 1].type, 'vague_memo');
  // scanned_count is preserved from the base report
  assert.equal(merged.scanned_count, base.scanned_count);
});
