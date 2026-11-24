import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPendingChoice } from './conversations';

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
