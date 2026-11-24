import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previousMonth } from './month-end-review';

test('previousMonth rolls back across the year boundary', () => {
  assert.equal(previousMonth(new Date('2027-01-02T17:00:00Z')), '2026-12');
  assert.equal(previousMonth(new Date('2026-12-02T17:00:00Z')), '2026-11');
});
