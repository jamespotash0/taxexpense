// Taxonomy-enforcement tests (DEC-065). canonicalizeCategory is the single guard that keeps the
// LLM from leaking invented categories into the dashboard + CSV export ("million categories").

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeCategory,
  isValidCategory,
  ALLOWED_CATEGORIES,
  CATEGORY_LABELS,
  QBO_ACCOUNTS,
} from './categories';

test('valid categories pass through unchanged', () => {
  for (const key of Object.keys(CATEGORY_LABELS)) {
    assert.deepEqual(canonicalizeCategory(key), { category: key, status: 'ok' });
  }
});

test('empty / missing → personal (extracted nothing)', () => {
  for (const raw of [null, undefined, '', '   ']) {
    assert.deepEqual(canonicalizeCategory(raw), { category: 'personal', status: 'empty' });
  }
});

test('formatting drift is normalized back to the real category', () => {
  assert.deepEqual(canonicalizeCategory('Meals_Business'), { category: 'meals_business', status: 'normalized' });
  assert.deepEqual(canonicalizeCategory('meals business'), { category: 'meals_business', status: 'normalized' });
  assert.deepEqual(canonicalizeCategory('vehicle-business'), { category: 'vehicle_business', status: 'normalized' });
  assert.deepEqual(canonicalizeCategory('  SOFTWARE  '), { category: 'software', status: 'normalized' });
});

test('invented / unknown categories drift to the business catch-all, never personal', () => {
  for (const invented of ['meals_client', 'subscription', 'travel', 'parking', 'misc']) {
    const result = canonicalizeCategory(invented);
    assert.equal(result.category, 'other_business', `${invented} should land in other_business`);
    assert.equal(result.status, 'drift');
  }
});

test('the catch-all bucket is itself a valid, mapped category', () => {
  assert.ok(ALLOWED_CATEGORIES.has('other_business'));
  assert.ok(isValidCategory('other_business'));
  assert.ok(CATEGORY_LABELS.other_business);
  assert.ok(QBO_ACCOUNTS.other_business);
});

test('isValidCategory rejects unknowns and accepts the closed set', () => {
  assert.equal(isValidCategory('nope'), false);
  assert.equal(isValidCategory(null), false);
  for (const key of ALLOWED_CATEGORIES) assert.equal(isValidCategory(key), true);
});
