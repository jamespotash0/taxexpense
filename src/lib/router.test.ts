// Unit tests for the SMS router's pure guardrails (DEC-029): the capture fast-path
// and the model-output sanitizer. The LLM classifier itself isn't unit-tested here.
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeExpenseCapture, isFlagRequest, sanitizeIntent, parseFlagTarget, bulkWaiveMessage, matchAgentNameMessage, greetingReply } from './router';

test('fast-path: obvious captures skip the classifier', () => {
  assert.equal(looksLikeExpenseCapture('$48 lunch with Sarah re partnership'), true);
  assert.equal(looksLikeExpenseCapture('drove 40 miles to Acme'), true);
  assert.equal(looksLikeExpenseCapture('12 dollars parking'), true);
});

test('fast-path: questions are NOT captured (go to classifier)', () => {
  assert.equal(looksLikeExpenseCapture('how much have I spent on meals?'), false);
  assert.equal(looksLikeExpenseCapture('what were my last 3 charges'), false);
  assert.equal(looksLikeExpenseCapture('how much is deductible this year?'), false);
});

test('fast-path: mixed "amount + question" defers to classifier', () => {
  // Has "$200" but is a question → must NOT fast-path to capture.
  assert.equal(looksLikeExpenseCapture('did I really spend $200 on software this month?'), false);
});

test('fast-path: empty / plain text', () => {
  assert.equal(looksLikeExpenseCapture(''), false);
  assert.equal(looksLikeExpenseCapture('hello'), false);
});

test('sanitize: valid query passes through with normalized params', () => {
  const i = sanitizeIntent({ intent: 'query', tool: 'aggregate', category: 'meals', period: 'this_year', count: null });
  assert.deepEqual(i, { kind: 'query', tool: 'aggregate', category: 'meals', period: 'this_year', count: undefined });
});

test('sanitize: unknown tool falls back to aggregate', () => {
  const i = sanitizeIntent({ intent: 'query', tool: 'frobnicate', category: null, period: null });
  assert.equal(i.kind === 'query' && i.tool, 'aggregate');
});

test('sanitize: invalid period dropped; unknown category nulled', () => {
  const i = sanitizeIntent({ intent: 'query', tool: 'aggregate', category: 'quantum widgets', period: 'forever' });
  assert.ok(i.kind === 'query');
  if (i.kind === 'query') {
    assert.equal(i.period, undefined);
    assert.equal(i.category, null);
  }
});

test('sanitize: recent count clamped to 1..10', () => {
  const i = sanitizeIntent({ intent: 'query', tool: 'recent', count: 99, category: null, period: null });
  assert.equal(i.kind === 'query' && i.count, 10);
});

test('sanitize: command whitelist; unknown command → help', () => {
  assert.deepEqual(sanitizeIntent({ intent: 'command', command: 'export' }), { kind: 'command', command: 'export' });
  assert.deepEqual(sanitizeIntent({ intent: 'command', command: 'delete_everything' }), { kind: 'help' });
});

test('parseFlagTarget: amount + keyword', () => {
  assert.deepEqual(parseFlagTarget('flag the $48 lunch'), { amountCents: 4800, term: 'lunch' });
});

test('parseFlagTarget: amount only (decimal)', () => {
  assert.deepEqual(parseFlagTarget('flag the $48.50 one'), { amountCents: 4850, term: undefined });
});

test('parseFlagTarget: vendor keyword only', () => {
  assert.deepEqual(parseFlagTarget('flag the Morton’s dinner'), { amountCents: undefined, term: 'Mortons dinner' });
});

test('parseFlagTarget: bare flag → no target (caller flags latest)', () => {
  assert.deepEqual(parseFlagTarget('flag this for my cpa'), { amountCents: undefined, term: undefined });
});

test('sanitize: advice / help / capture / unknown', () => {
  assert.deepEqual(sanitizeIntent({ intent: 'advice' }), { kind: 'advice' });
  assert.deepEqual(sanitizeIntent({ intent: 'help' }), { kind: 'help' });
  assert.deepEqual(sanitizeIntent({ intent: 'capability' }), { kind: 'capability' }); // "can it do X" / how it works
  assert.deepEqual(sanitizeIntent({ intent: 'capture' }), { kind: 'capture' });
  assert.deepEqual(sanitizeIntent({ intent: 'other' }), { kind: 'other' }); // off-topic → can't-help reply
  assert.deepEqual(sanitizeIntent({ intent: 'context_statement' }), { kind: 'context_statement' }); // detail about a logged expense
  assert.deepEqual(sanitizeIntent({ intent: 'something_weird' }), { kind: 'capture' }); // safe default
});

// Receipt resolution (reply about expenses still missing a receipt). Only an explicit "none" waives;
// any ambiguous/missing resolution defaults to the SAFE "later" so we never silently stop nudging.
test('sanitize: receipt_resolution honors "none", defaults ambiguous to "later"', () => {
  assert.deepEqual(sanitizeIntent({ intent: 'receipt_resolution', resolution: 'none' }), { kind: 'receipt_resolution', resolution: 'none' });
  assert.deepEqual(sanitizeIntent({ intent: 'receipt_resolution', resolution: 'later' }), { kind: 'receipt_resolution', resolution: 'later' });
  assert.deepEqual(sanitizeIntent({ intent: 'receipt_resolution' }), { kind: 'receipt_resolution', resolution: 'later' });
  assert.deepEqual(sanitizeIntent({ intent: 'receipt_resolution', resolution: 'garbage' }), { kind: 'receipt_resolution', resolution: 'later' });
});

test('bulkWaiveMessage: pluralizes and never over-claims', () => {
  assert.match(bulkWaiveMessage(1), /that expense/);
  assert.match(bulkWaiveMessage(3), /those 3 expenses/);
  for (const n of [1, 3]) {
    const m = bulkWaiveMessage(n);
    assert.match(m, /won't ask about .* again/i);
    assert.match(m, /accountant/i); // honest about the un-receipted gap
    for (const bad of ['audit-ready', 'complete', 'guaranteed']) {
      assert.ok(!m.toLowerCase().includes(bad), `"${bad}" must not appear: ${m}`);
    }
  }
});

test('matchAgentNameMessage: name questions and renames (DEC-086)', () => {
  for (const ask of ['Whats your name', "what's your name?", 'What is your name', 'who are you', 'what should I call you?', 'whats ur name']) {
    assert.deepEqual(matchAgentNameMessage(ask), { kind: 'ask' }, ask);
  }
  assert.deepEqual(matchAgentNameMessage('call you Max'), { kind: 'rename', name: 'Max' });
  assert.deepEqual(matchAgentNameMessage("I'm gonna call you ziggy!"), { kind: 'rename', name: 'Ziggy' });
  assert.deepEqual(matchAgentNameMessage('change your name to Bob'), { kind: 'rename', name: 'Bob' });
  // Expenses and unrelated chatter never match.
  for (const no of ['$40 lunch with Sam', 'what did I spend on meals?', 'hi', 'call my client about the invoice']) {
    assert.equal(matchAgentNameMessage(no), null, no);
  }
});

test('greetingReply: Penny introduces herself only at onboarding, then just talks like a friend', () => {
  const james = { full_name: 'James Potash' };
  for (const t of ['hi', 'Hey!', 'test', 'yo']) {
    const r = greetingReply(james, t);
    assert.equal(r, 'Hey James! 👋 What can I log for you?');
    assert.doesNotMatch(r, /it's Penny/);
  }
  assert.equal(greetingReply({ full_name: null }, 'hello'), 'Hey! 👋 What can I log for you?');
  assert.equal(greetingReply(james, 'thanks!'), 'Anytime! 🙌');
  assert.equal(greetingReply(james, 'thank you so much'), 'Anytime! 🙌');
  const help = greetingReply(james, 'what can you do?');
  assert.match(help, /receipt photo/);
  assert.doesNotMatch(help, /it's Penny/);
  assert.match(greetingReply(james, 'help'), /receipt photo/);
});

test('resolveContextChoice: out of range re-asks', async () => {
  const { resolveContextChoice } = await import('./router');
  const res = await resolveContextChoice({ id: 'u', organization_id: 'o' } as never, ['a', 'b'], 'x', 7);
  assert.match(res.smsText, /1-2/);
  assert.equal(res.receiptId, null);
  // The re-ask keeps the list open (a later outbound without this state closes it).
  assert.equal(res.contextState, 'awaiting_context_choice');
  assert.deepEqual(res.pendingData, { candidateIds: ['a', 'b'], contextText: 'x' });
});

test('resolveFlagChoice: out of range re-ask keeps the list open', async () => {
  const { resolveFlagChoice } = await import('./router');
  const res = await resolveFlagChoice({ id: 'u', organization_id: 'o' } as never, ['a', 'b'], 9);
  assert.equal(res.contextState, 'awaiting_flag_choice');
  assert.deepEqual(res.pendingData, { candidateIds: ['a', 'b'] });
});

// ---- Turn interpreter: which expense an edit lands on (Task 3) ------------------------------
import { editTarget } from './router';
import type { TurnDecision } from './turn';
import type { ReceiptRow } from './receipts';

const rcpt = (id: string) => ({ id, vendor: id, amount_cents: 100, transaction_date: null, created_at: '2026-11-25T00:00:00Z' }) as ReceiptRow;
const edit = (receiptId: string | null, candidates: string[] = []): TurnDecision => ({
  action: 'edit_expense', receiptId, candidates, answer: null, query: null, command: null, resolution: null,
});

test('editTarget: a valid receipt id applies to that expense', () => {
  assert.deepEqual(editTarget(edit('netflix'), [rcpt('optimum'), rcpt('netflix')]), { apply: rcpt('netflix') });
});

test('editTarget: unsure with candidates asks about just those', () => {
  assert.deepEqual(editTarget(edit(null, ['u1', 'u2']), [rcpt('u1'), rcpt('x'), rcpt('u2')]), { ask: [rcpt('u1'), rcpt('u2')] });
});

test('editTarget: unsure with no candidates asks about the 5 newest', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map(rcpt);
  assert.deepEqual(editTarget(edit(null), rows), { ask: rows.slice(0, 5) });
});

test('editTarget: no expenses at all → none', () => {
  assert.deepEqual(editTarget(edit(null), []), { none: true });
});

test('isFlagRequest: flag/CPA commands vs. expenses that mention them', () => {
  for (const t of ['flag the $48 lunch', 'flag this for my cpa', 'Flag it', 'please flag the Morton’s dinner', 'mark the uber for my CPA']) {
    assert.equal(isFlagRequest(t), true, t);
  }
  for (const t of ['$120 dinner with my CPA', '$30 flag banner for the booth', 'Paid my CPA $400 for taxes']) {
    assert.equal(isFlagRequest(t), false, t);
  }
});
