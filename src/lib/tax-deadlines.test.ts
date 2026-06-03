// Unit tests for tax-deadline reminder timing (DEC-024).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remindersDueOn } from './tax-deadlines';

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

test('7 days before Apr 15 → filing + Q1 grouped on one date', () => {
  const r = remindersDueOn(d('2026-04-08'));
  assert.equal(r.length, 1);
  assert.equal(r[0].dateISO, '2026-04-15');
  assert.equal(r[0].daysUntil, 7);
  assert.deepEqual(r[0].labels.sort(), ['Q1 estimated taxes', 'annual tax filing']);
});

test('1 day before Jun 15 → Q2 only', () => {
  const r = remindersDueOn(d('2026-06-14'));
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].labels, ['Q2 estimated taxes']);
  assert.equal(r[0].daysUntil, 1);
});

test('7 days before Jan 31 → 1099-NEC filing', () => {
  const r = remindersDueOn(d('2026-01-24'));
  assert.equal(r.length, 1);
  assert.equal(r[0].dateISO, '2026-01-31');
  assert.deepEqual(r[0].labels, ['1099-NEC filing']);
});

test('non-reminder day → nothing', () => {
  assert.deepEqual(remindersDueOn(d('2026-07-04')), []);
});

test('7 days before Jan 15 (year boundary) → Q4', () => {
  const r = remindersDueOn(d('2027-01-08'));
  assert.equal(r.length, 1);
  assert.equal(r[0].dateISO, '2027-01-15');
  assert.deepEqual(r[0].labels, ['Q4 estimated taxes']);
});

test('custom lead days', () => {
  const r = remindersDueOn(d('2026-09-14'), [1]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].labels, ['Q3 estimated taxes']);
  assert.equal(remindersDueOn(d('2026-09-08'), [1]).length, 0); // 7 days out, not in lead
});
