import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPendingChoice, pickPendingContext } from './conversations';

const flag = (at: string) => ({ context_state: 'awaiting_flag_choice', pending_data: { candidateIds: ['f1', 'f2'] }, created_at: at });
const ctx = (at: string) => ({ context_state: 'awaiting_context_choice', pending_data: { candidateIds: ['c1', 'c2'], contextText: 'that hotel was for the conference' }, created_at: at });

test('pickPendingChoice: newest wins', () => {
  assert.deepEqual(pickPendingChoice([flag('2026-11-24T10:00:00Z'), ctx('2026-11-24T11:00:00Z')]),
    { kind: 'context', candidateIds: ['c1', 'c2'], contextText: 'that hotel was for the conference' });
  assert.deepEqual(pickPendingChoice([flag('2026-11-24T12:00:00Z'), ctx('2026-11-24T11:00:00Z')]),
    { kind: 'flag', candidateIds: ['f1', 'f2'] });
});

test('pickPendingChoice: empty candidate list is null', () => {
  assert.equal(pickPendingChoice([{ context_state: 'awaiting_context_choice', pending_data: { candidateIds: [] }, created_at: '2026-11-24T11:00:00Z' }]), null);
  assert.equal(pickPendingChoice([]), null);
});

test('pickPendingChoice: a newer non-choice outbound closes the list', () => {
  const later = { context_state: 'awaiting_confirm', pending_data: { candidateIds: ['x'] }, created_at: '2026-11-24T12:00:00Z' };
  assert.equal(pickPendingChoice([ctx('2026-11-24T11:00:00Z'), later]), null);
  assert.equal(pickPendingChoice([ctx('2026-11-24T11:00:00Z'), { context_state: null, pending_data: null, created_at: '2026-11-24T12:00:00Z' }]), null);
});

// Repro (2026-11-25): a "Quick check" verify was answered (correction reply saved with context_state
// null), yet stayed "pending" for 24h, so the next new expense ("48 tools home depot") was applied
// as another correction to the old receipt.
test('pickPendingContext: an answered question (newer reply on a receipt, no state) is closed', () => {
  const ask = { receipt_id: 'r1', context_state: 'awaiting_confirm', message_text: 'Quick check!', created_at: '2026-11-25T02:16:49Z' };
  const answered = { receipt_id: 'r1', context_state: null, message_text: 'Updated', created_at: '2026-11-25T02:24:01Z' };
  assert.equal(pickPendingContext([answered, ask]), null);
  assert.deepEqual(pickPendingContext([ask]), { receiptId: 'r1', contextState: 'awaiting_confirm', questionText: 'Quick check!' });
});

test('pickPendingContext: a clean log of a DIFFERENT expense keeps the older question open', () => {
  const ask = { receipt_id: 'r1', context_state: 'awaiting_receipt', message_text: 'Send a receipt?', created_at: '2026-11-25T02:00:00Z' };
  const other = { receipt_id: 'r2', context_state: null, message_text: 'Locked in!', created_at: '2026-11-25T02:05:00Z' };
  assert.equal(pickPendingContext([other, ask])?.receiptId, 'r1');
});
