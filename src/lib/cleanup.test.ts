// Unit tests for the year-end cleanup scan (TSNAP-EPIC-9, deterministic checks).
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanReceipts,
  checkNeedsReceipt,
  checkMissingContext,
  checkDuplicates,
  checkMixedAccount,
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
    substantiation_complete: true,
    substantiation_missing_fields: null,
    raw_extracted_data: null,
    notes: null,
    created_at: '2026-03-10T00:00:00Z',
    ...over,
  };
}

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
