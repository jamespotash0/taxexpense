import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCandidateLine, contextChoiceMessage, withExpenseName } from './context-match';
import type { ReceiptRow } from './receipts';

const NOW = new Date('2026-11-24T18:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function row(over: Partial<ReceiptRow>): ReceiptRow {
  return {
    id: 'r1', vendor: 'Marriott', amount_cents: 23000, category: 'travel_lodging',
    transaction_date: '2026-11-22', created_at: ago(2 * DAY),
    ...over,
  } as ReceiptRow;
}

test('formatCandidateLine: null vendor shows Unknown', () => {
  const line = formatCandidateLine(row({ vendor: null }), NOW);
  assert.match(line, / · Unknown · /);
  assert.doesNotMatch(line, /null/);
});

test('formatCandidateLine: age buckets', () => {
  assert.match(formatCandidateLine(row({ created_at: ago(30 * MIN) }), NOW), /30 min ago/);
  assert.match(formatCandidateLine(row({ created_at: ago(5 * HOUR) }), NOW), /5 hours ago/);
  assert.match(formatCandidateLine(row({ created_at: ago(3 * DAY) }), NOW), /3 days ago/);
});

test('contextChoiceMessage: numbered, max 5', () => {
  const rows = Array.from({ length: 7 }, (_, i) => row({ id: `r${i}`, vendor: `V${i}` }));
  const msg = contextChoiceMessage(rows);
  assert.match(msg, /^Which expense was that about\?/);
  assert.match(msg, /5\) V4/);
  assert.doesNotMatch(msg, /6\)/);
  assert.match(msg, /Reply with a number\.$/);
});

test('withExpenseName: prefixes when vendor missing from reply', () => {
  assert.equal(withExpenseName('Updated, thanks!', row({})), 'Marriott $230.00: Updated, thanks!');
});

test('withExpenseName: no double name when present', () => {
  assert.equal(withExpenseName('Updated your marriott stay.', row({})), 'Updated your marriott stay.');
});

test('withExpenseName: unchanged when vendor null', () => {
  assert.equal(withExpenseName('Updated.', row({ vendor: null })), 'Updated.');
});
