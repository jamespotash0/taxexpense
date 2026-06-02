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
    raw_extracted_data: null, notes: null, created_at: '2026-04-15T00:00:00Z',
    ...partial,
  } as ReceiptRow;
}

test('standard CSV: header + escaped fields + dollar formatting', () => {
  const csv = toStandardCsv([receipt({})]);
  const [header, row] = csv.split('\n');
  assert.match(header, /^Date,Vendor,Amount,Category,IRC Section,Deductible Amount/);
  assert.match(row, /340\.00/);
  assert.match(row, /170\.00/);
  assert.match(row, /"Q3, with ""the team"""/); // comma + quotes escaped
  assert.match(row, /Yes$/); // documentation complete
});

test('QuickBooks CSV: maps category to QBO account', () => {
  const csv = toQuickbooksCsv([receipt({})]);
  const [header, row] = csv.split('\n');
  assert.equal(header, 'Date,Description,Amount,Account');
  assert.match(row, /Meals and Entertainment$/);
});
