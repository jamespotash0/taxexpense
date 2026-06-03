// Unit tests for the SMS router's pure guardrails (DEC-029): the capture fast-path
// and the model-output sanitizer. The LLM classifier itself isn't unit-tested here.
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeExpenseCapture, sanitizeIntent, parseFlagTarget } from './router';

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
  assert.deepEqual(sanitizeIntent({ intent: 'capture' }), { kind: 'capture' });
  assert.deepEqual(sanitizeIntent({ intent: 'something_weird' }), { kind: 'capture' }); // safe default
});
