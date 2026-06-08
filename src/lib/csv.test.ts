import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStandardCsv, toQuickbooksCsv } from './csv';
import type { ReceiptRow } from './receipts';

function receipt(partial: Partial<ReceiptRow>): ReceiptRow {
  return {
    id: 'r1', organization_id: 'o1', user_id: 'u1', vendor: 'Morton\'s', amount_cents: 34000,
    transaction_date: '2026-04-15', payment_account: 'business', category: 'meals_business',
    irc_section: '274', deduction_percentage: 50, deductible_amount_cents: 17000,
    business_purpose: 'Q3, with "the team"', attendees: 'John', business_relationship: 'client',
    location_city: null, business_miles: null, photo_url: null, needs_receipt: false,
    receipt_reason: null, substantiation_complete: true, substantiation_missing_fields: [],
    raw_extracted_data: null, notes: null, flagged_for_cpa: false,
    needs_review: false, review_reason: null, category_confidence: null,
    created_at: '2026-04-15T00:00:00Z',
    ...partial,
  } as ReceiptRow;
}

test('standard CSV: header + escaped fields + dollar formatting', () => {
  const csv = toStandardCsv([receipt({ flagged_for_cpa: true, needs_review: true })]);
  const [header, row] = csv.split('\n');
  assert.match(header, /^Date,Vendor,Amount,Category,IRC Section,Deductible Amount/);
  assert.match(header, /Documentation Complete,Flagged for CPA,Needs Review$/);
  assert.match(row, /340\.00/);
  assert.match(row, /170\.00/);
  assert.match(row, /"Q3, with ""the team"""/); // comma + quotes escaped
  assert.match(row, /Yes,Yes,Yes$/); // documentation complete + flagged for CPA + needs review
});

test('standard CSV: empty fields render as a dash', () => {
  const csv = toStandardCsv([
    receipt({ business_purpose: null, attendees: null, notes: null, flagged_for_cpa: false, needs_review: false }),
  ]);
  const row = csv.split('\n')[1];
  // Business Purpose, Attendees, Notes, Flagged for CPA, Needs Review are all empty → '-'.
  assert.match(row, /,-,-,/); // consecutive empty fields become dashes
  assert.match(row, /Yes,-,-$/); // documentation complete = Yes, then flagged + needs-review dashes
});

test('standard CSV: Receipt column reflects on-file / missing / waived (DEC-078)', () => {
  const onFile = toStandardCsv([receipt({ photo_url: 'path/x.jpg', needs_receipt: false })]).split('\n')[1];
  assert.match(onFile, /,On file,/);

  const missing = toStandardCsv([receipt({ photo_url: null, needs_receipt: true, receipt_waived_at: null })]).split('\n')[1];
  assert.match(missing, /,Missing,/);

  const waived = toStandardCsv([
    receipt({ photo_url: null, needs_receipt: true, receipt_waived_at: '2026-06-01T00:00:00Z' }),
  ]).split('\n')[1];
  assert.match(waived, /,None \(no receipt available\),/);
});

test('QuickBooks CSV: maps category to QBO account', () => {
  const csv = toQuickbooksCsv([receipt({})]);
  const [header, row] = csv.split('\n');
  assert.equal(header, 'Date,Description,Amount,Account');
  assert.match(row, /Meals and Entertainment$/);
});
