import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTurnContext, isAnythingOpen, type OpenState, type TurnContext } from './turn';
import type { ReceiptRow } from './receipts';

const NOW = new Date('2026-11-25T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const NONE: OpenState = { question: null, amount: null, choice: null, renewal: null };
const receipt = (id: string, vendor: string, dollars: number, category: string, ageMin: number) =>
  ({ id, vendor, amount_cents: dollars * 100, category, created_at: minsAgo(ageMin), transaction_date: null }) as ReceiptRow;
const ctx = (over: Partial<TurnContext> = {}): TurnContext => ({ messages: [], open: NONE, receipts: [], flaggedCount: 0, ...over });
const count = (hay: string, needle: string) => hay.split(needle).length - 1;

test('formatTurnContext drops the current inbound from history', () => {
  const out = formatTurnContext(
    ctx({ messages: [
      { direction: 'outbound', text: 'Got it! $100 at the grocery store', createdAt: minsAgo(30) },
      { direction: 'inbound', text: '48 tools home depot', createdAt: minsAgo(0) },
    ] }),
    '48 tools home depot',
    NOW,
  );
  assert.equal(count(out, '48 tools home depot'), 1, out);
  assert.match(out, /Message: 48 tools home depot/);
});

test('formatTurnContext keeps the last 6 messages, oldest first, outbound truncated to 200 chars', () => {
  const messages = Array.from({ length: 8 }, (_, i) => ({
    direction: (i % 2 ? 'outbound' : 'inbound') as 'inbound' | 'outbound',
    text: i === 7 ? 'x'.repeat(500) : `msg-${i}`,
    createdAt: minsAgo(80 - i * 10),
  }));
  const out = formatTurnContext(ctx({ messages }), 'new text', NOW);
  assert.ok(!out.includes('msg-0') && !out.includes('msg-1'), out);
  assert.ok(out.indexOf('msg-2') < out.indexOf('msg-6'), out);
  const long = out.split('\n').find((l) => l.includes('xxx'))!;
  assert.ok(!long.includes('x'.repeat(201)), long);
  assert.ok(long.includes('…'), long);
});

test('formatTurnContext lists the open question with its receipt id and state', () => {
  const out = formatTurnContext(
    ctx({ open: { ...NONE, question: { receiptId: 'optimum', contextState: 'awaiting_confirm', questionText: 'Not 100% sure on the category' } } }),
    'Log as business expense',
    NOW,
  );
  assert.match(out, /awaiting_confirm/);
  assert.match(out, /optimum/);
});

test('formatTurnContext lists expenses with ids', () => {
  const out = formatTurnContext(ctx({ receipts: [receipt('netflix', 'Netflix', 50, 'personal', 1)] }), 'business', NOW);
  assert.match(out, /netflix · Netflix · \$50\.00 · personal · logged 1 min ago/);
});

test('isAnythingOpen: nothing, pending amount, renewal', () => {
  assert.equal(isAnythingOpen(NONE), false);
  assert.equal(isAnythingOpen({ ...NONE, amount: { priorText: 'lunch', attempts: 0 } }), true);
  assert.equal(isAnythingOpen({ ...NONE, renewal: { id: 't1' } as OpenState['renewal'] }), true);
});

// ---- Task 2: decision validation + fallback -------------------------------------------------
import { fallbackDecision, validateDecision } from './turn';

test('validateDecision discards a receipt id that was not offered', () => {
  const d = validateDecision({ action: 'edit_expense', receipt_id: 'r9' }, ['netflix']);
  assert.equal(d?.action, 'edit_expense');
  assert.equal(d?.receiptId, null);
  assert.deepEqual(d?.candidates, []);
});

test('validateDecision filters candidates to offered ids', () => {
  const d = validateDecision({ action: 'edit_expense', receipt_id: null, candidates: ['uber1', 'evil', 'uber2'] }, ['uber1', 'uber2']);
  assert.deepEqual(d?.candidates, ['uber1', 'uber2']);
});

test('validateDecision returns null for an unknown action', () => {
  assert.equal(validateDecision({ action: 'delete_everything' }, []), null);
  assert.equal(validateDecision('nope', []), null);
});

test('validateDecision sanitizes query fields like sanitizeIntent (bad tool → aggregate)', () => {
  const d = validateDecision({ action: 'query', tool: 'hack', category: 'meals', period: 'this_month' }, []);
  assert.equal(d?.query?.tool, 'aggregate');
  assert.equal(d?.query?.period, 'this_month');
});

test('validateDecision keeps answer only when it is a known value', () => {
  assert.equal(validateDecision({ action: 'answer_open_question', answer: 'affirm' }, [])?.answer, 'affirm');
  assert.equal(validateDecision({ action: 'answer_open_question', answer: 'maybe' }, [])?.answer, 'detail');
});

test('fallbackDecision answers an open receipt question', () => {
  const d = fallbackDecision('it was with a client', { ...NONE, question: { receiptId: 'r1', contextState: 'awaiting_context', questionText: 'Who was it with?' } });
  assert.equal(d.action, 'answer_open_question');
  assert.equal(d.answer, 'detail');
});

test('fallbackDecision answers a pending amount', () => {
  assert.equal(fallbackDecision('167', { ...NONE, amount: { priorText: 'lunch', attempts: 0 } }).action, 'answer_open_question');
});

test('fallbackDecision with nothing open: an expense captures, chit-chat is help, never an edit', () => {
  assert.equal(fallbackDecision('$30 gas', NONE).action, 'new_expense');
  assert.equal(fallbackDecision('thanks', NONE).action, 'help');
  for (const t of ['$30 gas', 'thanks', 'that was personal']) assert.notEqual(fallbackDecision(t, NONE).action, 'edit_expense');
});
