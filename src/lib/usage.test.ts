// Unit tests for the usage-cap decision logic (DEC-050 — unit economics / cost control).
// Run: npm run test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideUsage,
  DAILY_RECEIPT_CAP,
  ANNUAL_WARN_AT,
  ANNUAL_WARN_EVERY,
  ANNUAL_RECEIPT_QUOTA,
  ANNUAL_HARD_STOP,
} from './usage';

test('well under both caps → ok', () => {
  assert.deepEqual(decideUsage({ receiptsToday: 3, receiptsYear: 40 }), { kind: 'ok' });
});

test('daily cap blocks at the threshold, not before', () => {
  assert.equal(decideUsage({ receiptsToday: DAILY_RECEIPT_CAP - 1, receiptsYear: 100 }).kind, 'ok');
  assert.equal(decideUsage({ receiptsToday: DAILY_RECEIPT_CAP, receiptsYear: 100 }).kind, 'block_daily');
});

test('annual nudge fires at the warn line and at milestones, but not in between', () => {
  assert.deepEqual(decideUsage({ receiptsToday: 1, receiptsYear: ANNUAL_WARN_AT }), {
    kind: 'warn_annual',
    used: ANNUAL_WARN_AT,
  });
  assert.equal(decideUsage({ receiptsToday: 1, receiptsYear: ANNUAL_WARN_AT + 1 }).kind, 'ok');
  assert.equal(decideUsage({ receiptsToday: 1, receiptsYear: ANNUAL_WARN_AT + ANNUAL_WARN_EVERY }).kind, 'warn_annual');
});

test('within the grace buffer past quota → still logs (no hard block)', () => {
  assert.notEqual(decideUsage({ receiptsToday: 1, receiptsYear: ANNUAL_RECEIPT_QUOTA }).kind, 'block_annual');
  assert.notEqual(decideUsage({ receiptsToday: 1, receiptsYear: ANNUAL_HARD_STOP - 1 }).kind, 'block_annual');
});

test('annual hard stop blocks at the grace ceiling', () => {
  assert.equal(decideUsage({ receiptsToday: 1, receiptsYear: ANNUAL_HARD_STOP }).kind, 'block_annual');
});

test('annual hard stop takes priority over the daily cap', () => {
  assert.equal(
    decideUsage({ receiptsToday: DAILY_RECEIPT_CAP, receiptsYear: ANNUAL_HARD_STOP }).kind,
    'block_annual',
  );
});
